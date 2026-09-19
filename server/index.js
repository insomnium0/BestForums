const fs = require('fs');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const port = Number(process.env.PORT || 3000);
const dataFile = process.env.BESTFORUMS_DATA_FILE || path.join(__dirname, 'data.json');
let state = { posts: [], groups: [{ id: 'lobby', name: 'Lobby', messages: [] }] };

try { state = { ...state, ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; } catch {}
const save = () => fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, clients: wss.clients.size }));
});
const wss = new WebSocketServer({ server });
const broadcast = () => {
  const message = JSON.stringify({ type: 'state', state, clients: wss.clients.size });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
};

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'state', state, clients: wss.clients.size }));
  broadcast();
  socket.on('message', (raw) => {
    let message; try { message = JSON.parse(raw); } catch { return; }
    if (message.type === 'import' && state.posts.length === 0) state.posts = message.posts || [];
    if (message.type === 'post') state.posts.unshift(message.post);
    if (message.type === 'delete') state.posts = state.posts.filter((post) => post.id !== message.id);
    if (message.type === 'vote') state.posts = state.posts.map((post) => post.id === message.id ? { ...post, voters: message.voters } : post);
    if (message.type === 'chat') {
      const group = state.groups.find((item) => item.id === message.groupId);
      if (group) group.messages.push(message.message);
    }
    save(); broadcast();
  });
  socket.on('close', broadcast);
});
server.listen(port, '0.0.0.0', () => console.log(`BestForums LAN server: ws://YOUR_COMPUTER_IP:${port}`));
