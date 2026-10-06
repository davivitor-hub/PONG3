const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const rooms = new Map();

app.use(express.static(__dirname));
app.get('/join/:code', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function cleanCode(v) { return String(v || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 8); }
function makeCode() {
  let code;
  do code = Math.floor(100000 + Math.random() * 900000).toString(); while (rooms.has(code));
  return code;
}
function roomList() {
  return [...rooms.values()].filter(r => r.public && r.players.length < 2).map(r => ({ code: r.code, name: r.name, players: r.players.length }));
}
function publishRooms() { io.emit('rooms:update', roomList()); }
function initialBall() {
  const dir = Math.random() < .5 ? -1 : 1;
  const angle = (Math.random() * .8 - .4);
  return { x: 400, y: 300, vx: dir * 7, vy: angle * 6 };
}
function newRoom(code, name, isPublic) {
  return {
    code, name: name || `Arena ${code}`, public: !!isPublic, players: [],
    p1: 250, p2: 250, score1: 0, score2: 0, ball: initialBall(),
    running: false, lastTick: Date.now(), countdown: 0
  };
}
function publicState(r) {
  return { p1: r.p1, p2: r.p2, score1: r.score1, score2: r.score2, ball: r.ball, running: r.running };
}
function sendState(r) { io.to(r.code).emit('state', publicState(r)); }

function resetRound(r, scorer) {
  if (scorer === 1) r.score1++; else r.score2++;
  const win = r.score1 >= 7 || r.score2 >= 7;
  r.p1 = 250; r.p2 = 250; r.ball = initialBall();
  if (win) {
    r.running = false;
    io.to(r.code).emit('match:over', { winner: r.score1 >= 7 ? 1 : 2, score1: r.score1, score2: r.score2 });
  }
}

function tickRoom(r) {
  if (!r.running || r.players.length !== 2) return;
  const now = Date.now();
  const dt = Math.min((now - r.lastTick) / 16.6667, 2);
  r.lastTick = now;
  const b = r.ball;
  const paddleH = 96, paddleW = 14, top = 20, bottom = 580 - paddleH;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.y <= 16) { b.y = 16; b.vy = Math.abs(b.vy); }
  if (b.y >= 584) { b.y = 584; b.vy = -Math.abs(b.vy); }
  if (b.x <= 38 + paddleW && b.x >= 24 && b.vx < 0 && b.y >= r.p1 && b.y <= r.p1 + paddleH) {
    const hit = (b.y - (r.p1 + paddleH / 2)) / (paddleH / 2);
    b.x = 38 + paddleW; b.vx = Math.min(Math.abs(b.vx) * 1.045 + .18, 15); b.vy = clamp(b.vy + hit * 2.2, -11, 11);
  }
  if (b.x >= 762 - paddleW && b.x <= 776 && b.vx > 0 && b.y >= r.p2 && b.y <= r.p2 + paddleH) {
    const hit = (b.y - (r.p2 + paddleH / 2)) / (paddleH / 2);
    b.x = 762 - paddleW; b.vx = -Math.min(Math.abs(b.vx) * 1.045 + .18, 15); b.vy = clamp(b.vy + hit * 2.2, -11, 11);
  }
  if (b.x < -30) resetRound(r, 2);
  if (b.x > 830) resetRound(r, 1);
}
setInterval(() => { for (const r of rooms.values()) tickRoom(r); }, 1000 / 60);
setInterval(() => { for (const r of rooms.values()) if (r.running) sendState(r); }, 1000 / 30);

io.on('connection', socket => {
  socket.emit('rooms:update', roomList());

  socket.on('rooms:list', () => socket.emit('rooms:update', roomList()));

  socket.on('room:create', payload => {
    const requested = cleanCode(payload?.code);
    const code = requested || makeCode();
    if (rooms.has(code)) return socket.emit('room:error', 'Esse código já está em uso.');
    const room = newRoom(code, String(payload?.name || '').trim().slice(0, 24), payload?.public !== false);
    room.players.push(socket.id); rooms.set(code, room);
    socket.join(code); socket.data.room = code; socket.data.player = 1;
    socket.emit('room:created', { code, name: room.name, player: 1 }); publishRooms();
  });

  socket.on('room:join', raw => {
    const code = cleanCode(raw);
    const room = rooms.get(code);
    if (!room) return socket.emit('room:error', 'Sala não encontrada.');
    if (room.players.length >= 2) return socket.emit('room:error', 'A sala já está cheia.');
    room.players.push(socket.id); socket.join(code); socket.data.room = code; socket.data.player = 2;
    socket.emit('room:joined', { code, name: room.name, player: 2 });
    room.running = true; room.lastTick = Date.now();
    io.to(code).emit('match:start', publicState(room)); publishRooms();
  });

  socket.on('paddle:set', y => {
    const r = rooms.get(socket.data.room); if (!r) return;
    const next = clamp(Number(y) || 0, 20, 484);
    if (socket.data.player === 1) r.p1 = next;
    if (socket.data.player === 2) r.p2 = next;
  });

  socket.on('match:restart', () => {
    const r = rooms.get(socket.data.room); if (!r || r.players.length !== 2) return;
    if (r.score1 >= 7 || r.score2 >= 7) { r.score1 = 0; r.score2 = 0; }
    r.p1 = r.p2 = 250; r.ball = initialBall(); r.running = true; r.lastTick = Date.now();
    io.to(r.code).emit('match:start', publicState(r));
  });

  socket.on('room:leave', () => leave(socket));
  socket.on('disconnect', () => leave(socket));
});
function leave(socket) {
  const code = socket.data.room; if (!code) return;
  const r = rooms.get(code); if (!r) return;
  io.to(code).emit('room:closed'); rooms.delete(code); publishRooms(); socket.data.room = null;
}

server.listen(PORT, HOST, () => {
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
  console.log(`Pong Neon Arena iniciado em ${publicUrl}`);
  console.log(`Servidor ouvindo em ${HOST}:${PORT}`);
});
