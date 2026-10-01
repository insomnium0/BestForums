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
`);

const postCount = db.prepare('SELECT COUNT(*) AS count FROM posts');
const insertPost = db.prepare('INSERT OR IGNORE INTO posts (id, payload, created_at) VALUES (?, ?, ?)');
const deletePost = db.prepare('DELETE FROM posts WHERE id = ?');
const clearSpikePosts = db.prepare("DELETE FROM posts WHERE json_extract(payload, '$.spike') = 1");
const updatePost = db.prepare('UPDATE posts SET payload = ? WHERE id = ?');
const recentPosts = db.prepare('SELECT payload FROM posts ORDER BY created_at DESC LIMIT ?');
const allPosts = db.prepare('SELECT payload FROM posts ORDER BY created_at DESC');
const insertMessage = db.prepare('INSERT OR IGNORE INTO messages (id, group_id, payload, received_at) VALUES (?, ?, ?, ?)');
const recentMessages = db.prepare('SELECT payload FROM messages WHERE group_id = ? ORDER BY received_at DESC LIMIT ?');
const allMessages = db.prepare('SELECT payload FROM messages WHERE group_id = ? ORDER BY received_at ASC');

const asTime = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : Date.now();
};
const parseRows = (rows) => rows.map((row) => JSON.parse(row.payload));
const addPost = (post) => { if (post?.id) insertPost.run(post.id, JSON.stringify(post), asTime(post.createdAt)); };
const addMessage = (groupId, message) => { if (message?.id) insertMessage.run(message.id, groupId || 'lobby', JSON.stringify(message), asTime(String(message.id).split('-')[0])); };

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
const archiveFileName = (reason) => `bestforums-${safeStamp()}-${reason}.sqlite`;
async function createArchive(reason = 'manual') {
  const file = path.join(archiveDir, archiveFileName(reason.replace(/[^a-z0-9-]/gi, '-')));
  await backup(db, file, { rate: 100 });
  return file;
}
const archiveList = () => fs.readdirSync(archiveDir)
  .filter((name) => name.endsWith('.sqlite'))
  .map((name) => ({ name, bytes: fs.statSync(path.join(archiveDir, name)).size, createdAt: fs.statSync(path.join(archiveDir, name)).mtime.toISOString() }))
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const sendJson = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  response.end(JSON.stringify(data));
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && url.pathname === '/') return sendJson(response, 200, { ok: true, clients: wss.clients.size, totalPosts: postCount.get().count, archives: '/archives' });
  if (request.method === 'GET' && url.pathname === '/archives') return sendJson(response, 200, { archives: archiveList() });
  if (request.method === 'POST' && url.pathname === '/archives') {
    try {
      const file = await createArchive('manual');
      const name = path.basename(file);
      return sendJson(response, 201, { name, downloadUrl: `${url.origin}/archives/${encodeURIComponent(name)}` });
    } catch (error) { return sendJson(response, 500, { error: `Archive failed: ${error.message}` }); }
  }
  if (request.method === 'GET' && url.pathname.startsWith('/archives/')) {
    const name = path.basename(decodeURIComponent(url.pathname.slice('/archives/'.length)));
    const file = path.join(archiveDir, name);
    if (name !== path.basename(name) || !name.endsWith('.sqlite') || !fs.existsSync(file)) return sendJson(response, 404, { error: 'Archive not found' });
    response.writeHead(200, { 'Content-Type': 'application/vnd.sqlite3', 'Content-Disposition': `attachment; filename="${name}"`, 'Content-Length': fs.statSync(file).size });
    return fs.createReadStream(file).pipe(response);
  }
  return sendJson(response, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server });
const stateMessage = () => JSON.stringify({ type: 'state', state: clientState(), clients: wss.clients.size, totalPosts: postCount.get().count, clientPostLimit, clientMessageLimit });
const broadcast = () => {
  const message = stateMessage();
  wss.clients.forEach((client) => { if (client.readyState === WebSocket.OPEN) client.send(message); });
};

wss.on('connection', (socket) => {
  socket.send(stateMessage());
  broadcast();
  socket.on('message', async (raw) => {
    let message; try { message = JSON.parse(raw); } catch { return; }
    try {
      if (message.type === 'import' && postCount.get().count === 0) {
        db.exec('BEGIN');
        (message.posts || []).forEach(addPost);
        db.exec('COMMIT');
      }
      if (message.type === 'post') addPost(message.post);
      if (message.type === 'delete' && message.id) deletePost.run(message.id);
      if (message.type === 'clear-spike') {
        await createArchive('before-clear-spike');
        clearSpikePosts.run();
      }
      if (message.type === 'vote' && message.id && Array.isArray(message.voters)) {
        const post = getPost(message.id);
        if (post) updatePost.run(JSON.stringify({ ...post, voters: message.voters }), post.id);
      }
      if (message.type === 'chat') addMessage(message.groupId, message.message);
      broadcast();
    } catch (error) {
      console.error(`LAN message failed: ${error.message}`);
      try { socket.send(JSON.stringify({ type: 'error', message: 'The server could not save that change.' })); } catch {}
    }
  });
  socket.on('close', broadcast);
});

server.listen(port, host, async () => {
  console.log(`BestForums LAN server: ws://YOUR_COMPUTER_IP:${port}`);
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
