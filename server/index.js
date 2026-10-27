const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { backup, DatabaseSync } = require('node:sqlite');
const { WebSocketServer, WebSocket } = require('ws');

const port = Number(process.env.PORT || 3000);
const host = process.env.BESTFORUMS_HOST || '0.0.0.0';
const dataFile = process.env.BESTFORUMS_DATA_FILE || path.join(__dirname, 'data.json');
const databaseFile = process.env.BESTFORUMS_DB_FILE || path.join(__dirname, 'bestforums.sqlite');
const archiveDir = process.env.BESTFORUMS_ARCHIVE_DIR || path.join(__dirname, 'archives');
const clientPostLimit = Number(process.env.BESTFORUMS_CLIENT_POST_LIMIT || 80);
const clientMessageLimit = Number(process.env.BESTFORUMS_CLIENT_MESSAGE_LIMIT || 150);
const publicOrigin = process.env.BESTFORUMS_PUBLIC_URL?.replace(/\/$/, '');

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
fs.mkdirSync(archiveDir, { recursive: true });

const db = new DatabaseSync(databaseFile, { timeout: 5000 });
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = FULL;
  PRAGMA foreign_keys = ON;
  PRAGMA max_page_count = 2147483646;
  CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL) STRICT;
  CREATE INDEX IF NOT EXISTS posts_created_at ON posts(created_at DESC);
  CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, payload TEXT NOT NULL, received_at INTEGER NOT NULL) STRICT;
  CREATE INDEX IF NOT EXISTS messages_received_at ON messages(received_at ASC);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL) STRICT;
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL) STRICT;
  CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
`);

const postCount = db.prepare('SELECT COUNT(*) AS count FROM posts');
const insertPost = db.prepare('INSERT OR IGNORE INTO posts (id, payload, created_at) VALUES (?, ?, ?)');
const deletePost = db.prepare('DELETE FROM posts WHERE id = ?');
const updatePost = db.prepare('UPDATE posts SET payload = ? WHERE id = ?');
const recentPosts = db.prepare('SELECT payload FROM posts ORDER BY created_at DESC LIMIT ?');
const allPosts = db.prepare('SELECT payload FROM posts ORDER BY created_at DESC');
const insertMessage = db.prepare('INSERT OR IGNORE INTO messages (id, group_id, payload, received_at) VALUES (?, ?, ?, ?)');
const recentMessages = db.prepare('SELECT payload FROM messages WHERE group_id = ? ORDER BY received_at DESC LIMIT ?');
const archivedMessages = db.prepare('SELECT group_id, payload, received_at FROM messages ORDER BY received_at ASC');
const findUserByName = db.prepare('SELECT id, username, password_salt, password_hash FROM users WHERE username = ?');
const insertUser = db.prepare('INSERT INTO users (id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)');
const insertSession = db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)');
const findSession = db.prepare('SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?');
const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
const deleteExpiredSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');

const SESSION_DAYS = Number(process.env.BESTFORUMS_SESSION_DAYS || 30);
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const passwordHash = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
const validUsername = (username) => /^[a-zA-Z0-9_.-]{2,32}$/.test(username);
const publicUser = (user) => ({ id: user.id, username: user.username });
function createSession(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  deleteExpiredSessions.run(now);
  insertSession.run(tokenHash(token), user.id, expiresAt, now);
  return { token, user: publicUser(user), expiresAt };
}
function sessionForToken(token) { return typeof token === 'string' ? findSession.get(tokenHash(token), Date.now()) : null; }
async function readJson(request) {
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > 16 * 1024) throw new Error('Request body is too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new Error('Invalid JSON.'); }
}
const authToken = (request) => request.headers.authorization?.replace(/^Bearer\s+/i, '');
const asTime = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : Date.now();
};
const parseRows = (rows) => rows.map((row) => JSON.parse(row.payload));
const addPost = (post) => { if (post?.id) insertPost.run(post.id, JSON.stringify(post), asTime(post.createdAt)); };
const addMessage = (groupId, message) => {
  if (!message?.id) return;
  const receivedAt = Date.now();
  const savedMessage = { ...message, createdAt: message.createdAt || new Date(receivedAt).toISOString() };
  insertMessage.run(savedMessage.id, groupId || 'lobby', JSON.stringify(savedMessage), receivedAt);
};

// Preserve forums made with the earlier JSON-only LAN server on first upgrade.
if (postCount.get().count === 0 && fs.existsSync(dataFile)) {
  try {
    const legacy = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    db.exec('BEGIN');
    (legacy.posts || []).forEach(addPost);
    (legacy.groups || []).forEach((group) => (group.messages || []).forEach((message) => addMessage(group.id, message)));
    db.exec('COMMIT');
    console.log(`Imported ${legacy.posts?.length || 0} legacy posts from ${dataFile}`);
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error(`Could not import legacy data.json: ${error.message}`);
  }
}

const getPost = (postId) => {
  const row = db.prepare('SELECT payload FROM posts WHERE id = ?').get(postId);
  return row ? JSON.parse(row.payload) : null;
};
const clientState = () => ({
  posts: parseRows(recentPosts.all(clientPostLimit)),
  groups: [{ id: 'lobby', name: 'Lobby', messages: parseRows(recentMessages.all('lobby', clientMessageLimit)).reverse() }],
});
const safeStamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const archiveBaseName = (reason) => `bestforums-${safeStamp()}-${reason.replace(/[^a-z0-9-]/gi, '-')}`;
async function createArchive(reason = 'manual') {
  const baseName = archiveBaseName(reason);
  const databasePath = path.join(archiveDir, `${baseName}.sqlite`);
  const chatPath = path.join(archiveDir, `${baseName}.chat.json`);
  await backup(db, databasePath, { rate: 100 });
  const conversations = archivedMessages.all().reduce((groups, row) => {
    const messages = groups[row.group_id] || (groups[row.group_id] = []);
    messages.push({ ...JSON.parse(row.payload), receivedAt: new Date(row.received_at).toISOString() });
    return groups;
  }, {});
  await fs.promises.writeFile(chatPath, `${JSON.stringify({ format: 'bestforums-chat-archive/v1', createdAt: new Date().toISOString(), conversations }, null, 2)}\n`, 'utf8');
  return { databasePath, chatPath };
}
const archiveList = () => fs.readdirSync(archiveDir)
  .filter((name) => name.endsWith('.sqlite'))
  .map((name) => ({ name, bytes: fs.statSync(path.join(archiveDir, name)).size, createdAt: fs.statSync(path.join(archiveDir, name)).mtime.toISOString() }))
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const sendJson = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  response.end(JSON.stringify(data));
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'OPTIONS') return sendJson(response, 204, {});
  if (request.method === 'POST' && url.pathname === '/auth/register') {
    try {
      const { username, password } = await readJson(request);
      const cleanName = String(username || '').trim();
      if (!validUsername(cleanName)) return sendJson(response, 400, { error: 'Username must be 2–32 characters: letters, numbers, dot, underscore, or hyphen.' });
      if (typeof password !== 'string' || password.length < 8) return sendJson(response, 400, { error: 'Password must contain at least 8 characters.' });
      if (findUserByName.get(cleanName)) return sendJson(response, 409, { error: 'That username is already taken.' });
      const user = { id: crypto.randomUUID(), username: cleanName };
      const salt = crypto.randomBytes(16).toString('hex');
      insertUser.run(user.id, user.username, salt, passwordHash(password, salt), Date.now());
      return sendJson(response, 201, createSession(user));
    } catch (error) { return sendJson(response, 400, { error: error.message || 'Could not create account.' }); }
  }
  if (request.method === 'POST' && url.pathname === '/auth/login') {
    try {
      const { username, password } = await readJson(request);
      const user = findUserByName.get(String(username || '').trim());
      const submitted = typeof password === 'string' && user ? Buffer.from(passwordHash(password, user.password_salt), 'hex') : null;
      const stored = user ? Buffer.from(user.password_hash, 'hex') : null;
      if (!submitted || !stored || submitted.length !== stored.length || !crypto.timingSafeEqual(submitted, stored)) return sendJson(response, 401, { error: 'Incorrect username or password.' });
      return sendJson(response, 200, createSession(user));
    } catch (error) { return sendJson(response, 400, { error: error.message || 'Could not sign in.' }); }
  }
  if (request.method === 'POST' && url.pathname === '/auth/logout') {
    const token = authToken(request); if (token) deleteSession.run(tokenHash(token)); return sendJson(response, 204, {});
  }
  if (request.method === 'GET' && url.pathname === '/auth/me') {
    const user = sessionForToken(authToken(request)); return user ? sendJson(response, 200, { user: publicUser(user) }) : sendJson(response, 401, { error: 'Sign in required.' });
  }
  if (request.method === 'GET' && url.pathname === '/') return sendJson(response, 200, { ok: true, clients: [...wss.clients].filter((client) => client.user).length, totalPosts: postCount.get().count, auth: '/auth/login', archives: '/archives' });
  if (request.method === 'GET' && url.pathname === '/archives') { if (!sessionForToken(authToken(request))) return sendJson(response, 401, { error: 'Sign in required.' }); return sendJson(response, 200, { archives: archiveList() }); }
  if (request.method === 'POST' && url.pathname === '/archives') {
    if (!sessionForToken(authToken(request))) return sendJson(response, 401, { error: 'Sign in required.' });
    try {
      const archive = await createArchive('manual');
      const databaseName = path.basename(archive.databasePath);
      const chatName = path.basename(archive.chatPath);
      const origin = publicOrigin || url.origin;
      return sendJson(response, 201, { database: { name: databaseName, downloadUrl: `${origin}/archives/${encodeURIComponent(databaseName)}` }, chat: { name: chatName, downloadUrl: `${origin}/archives/${encodeURIComponent(chatName)}` } });
    } catch (error) { return sendJson(response, 500, { error: `Archive failed: ${error.message}` }); }
  }
  if (request.method === 'GET' && url.pathname.startsWith('/archives/')) {
    if (!sessionForToken(authToken(request))) return sendJson(response, 401, { error: 'Sign in required.' });
    const name = path.basename(decodeURIComponent(url.pathname.slice('/archives/'.length)));
    const file = path.join(archiveDir, name);
    const isDatabase = name.endsWith('.sqlite');
    const isChatTranscript = name.endsWith('.chat.json');
    if (name !== path.basename(name) || (!isDatabase && !isChatTranscript) || !fs.existsSync(file)) return sendJson(response, 404, { error: 'Archive not found' });
    response.writeHead(200, { 'Content-Type': isDatabase ? 'application/vnd.sqlite3' : 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Content-Length': fs.statSync(file).size });
    return fs.createReadStream(file).pipe(response);
  }
  return sendJson(response, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server });
const stateMessage = () => JSON.stringify({ type: 'state', state: clientState(), clients: [...wss.clients].filter((client) => client.user).length, totalPosts: postCount.get().count, clientPostLimit, clientMessageLimit });
const broadcast = () => {
  const message = stateMessage();
  wss.clients.forEach((client) => { if (client.user && client.readyState === WebSocket.OPEN) client.send(message); });
};

wss.on('connection', (socket) => {
  socket.user = null;
  socket.send(JSON.stringify({ type: 'auth-required' }));
  socket.on('message', async (raw) => {
    let message; try { message = JSON.parse(raw); } catch { return; }
    try {
      if (message.type === 'auth') {
        const user = sessionForToken(message.token);
        if (!user) { socket.send(JSON.stringify({ type: 'auth-error', message: 'Your session has expired. Sign in again.' })); return; }
        socket.user = user;
        socket.send(JSON.stringify({ type: 'auth', user: publicUser(user) }));
        socket.send(stateMessage());
        broadcast();
        return;
      }
      if (!socket.user) { socket.send(JSON.stringify({ type: 'auth-error', message: 'Sign in before using the forum.' })); return; }
      if (message.type === 'import' && postCount.get().count === 0) {
        db.exec('BEGIN');
        (message.posts || []).forEach(addPost);
        db.exec('COMMIT');
      }
      if (message.type === 'post' && message.post) addPost({ ...message.post, author: socket.user.username, authorId: socket.user.id, anonymous: false });
      if (message.type === 'update' && message.post?.id) { const existing = getPost(message.post.id); if (existing?.authorId === socket.user.id) updatePost.run(JSON.stringify({ ...message.post, author: existing.author, authorId: existing.authorId }), message.post.id); }
      if (message.type === 'comment' && message.postId && message.comment?.id) { const post = getPost(message.postId); if (post) { const comment = { ...message.comment, author: socket.user.username, authorId: socket.user.id, createdAt: message.comment.createdAt || new Date().toISOString() }; updatePost.run(JSON.stringify({ ...post, comments: [...(post.comments || []), comment] }), post.id); } }
      if (message.type === 'delete' && message.id) { const existing = getPost(message.id); if (existing?.authorId === socket.user.id) deletePost.run(message.id); }
      if (message.type === 'vote' && message.id && Array.isArray(message.voters)) {
        const post = getPost(message.id);
        if (post) updatePost.run(JSON.stringify({ ...post, voters: message.voters }), post.id);
      }
      if (message.type === 'chat' && message.message) addMessage(message.groupId, { ...message.message, author: socket.user.username, authorId: socket.user.id });
      broadcast();
    } catch (error) {
      console.error(`LAN message failed: ${error.message}`);
      try { socket.send(JSON.stringify({ type: 'error', message: 'The server could not save that change.' })); } catch {}
    }
  });
  socket.on('close', broadcast);
});

server.listen(port, host, async () => {
  console.log(`BestForums server: ws://YOUR_COMPUTER_IP:${port} (LAN) or place a TLS proxy in front for wss:// Internet access`);
  console.log(`Database: ${databaseFile}`);
  console.log(`Archives: http://YOUR_COMPUTER_IP:${port}/archives`);
  try { await createArchive('startup'); } catch (error) { console.error(`Startup archive failed: ${error.message}`); }
});

const dailyArchive = setInterval(() => { createArchive('daily').catch((error) => console.error(`Daily archive failed: ${error.message}`)); }, 24 * 60 * 60 * 1000);
dailyArchive.unref();
let closing = false;
async function closeServer() {
  if (closing) return;
  closing = true;
  try { await createArchive('shutdown'); } catch (error) { console.error(`Shutdown archive failed: ${error.message}`); }
  db.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);
