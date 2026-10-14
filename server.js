const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, transports: ['websocket', 'polling'] });
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.get('/join/:roomId', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const rooms = new Map();
const waiting = [];
const W = 800, H = 600, PADDLE_H = 100, BALL_R = 10;
let roomCounter = 100000;

function newRoomId() {
  let id;
  do { roomCounter = (roomCounter + 7919) % 900000 + 100000; id = String(roomCounter); } while (rooms.has(id));
  return id;
}
function makeBall(dir = Math.random() < .5 ? -1 : 1) {
  const angle = (Math.random() * .9) - .45;
  const speed = 8.8;
  return { x: W/2, y: H/2, vx: Math.cos(angle) * speed * dir, vy: Math.sin(angle) * speed };
}
function createRoom(socket) {
  const id = newRoomId();
  const room = { id, players: [socket.id], p1: H/2-PADDLE_H/2, p2: H/2-PADDLE_H/2,
    score1: 0, score2: 0, ball: makeBall(), started: false, powerup: null, powerTimer: 0,
    lastHit: 0, created: Date.now() };
  rooms.set(id, room);
  socket.join(id); socket.roomId = id; socket.playerNum = 1;
  socket.emit('match:role', { player: 1, roomId: id });
  socket.emit('match:waiting', { roomId: id, player: 1, link: `/join/${id}` });
  return room;
}
function joinRoom(socket, id) {
  const room = rooms.get(String(id));
  if (!room) { socket.emit('match:error', 'Partida não encontrada. Volte ao menu e tente novamente.'); return; }
  if (room.players.length >= 2 || room.players.includes(socket.id)) {
    if (room.players.includes(socket.id)) return;
    socket.emit('match:error', 'Essa partida já está cheia.'); return;
  }
  room.players.push(socket.id);
  socket.join(room.id); socket.roomId = room.id; socket.playerNum = 2; room.started = true;
  socket.emit('match:role', { player: 2, roomId: room.id });
  io.to(room.players[0]).emit('match:role', { player: 1, roomId: room.id });
  room.ball = makeBall();
  io.to(room.id).emit('match:start', snapshot(room));
}
function snapshot(r) {
  return { p1:r.p1, p2:r.p2, score1:r.score1, score2:r.score2, ball:r.ball,
    powerup:r.powerup, running:r.started, playerCount:r.players.length };
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function resetBall(room, dir) {
  room.ball = makeBall(dir);
  room.powerup = null;
  room.powerTimer = 0;
}
function update(room) {
  if (!room.started || room.players.length !== 2) return;
  const b = room.ball;
  b.x += b.vx; b.y += b.vy;
  if (b.y < BALL_R || b.y > H-BALL_R) {
    b.y = clamp(b.y, BALL_R, H-BALL_R); b.vy *= -1;
  }
  // Rebate com ângulo determinado pelo ponto de contato e aceleração progressiva.
  if (b.vx < 0 && b.x-BALL_R <= 42 && b.x > 20 && b.y >= room.p1-BALL_R && b.y <= room.p1+PADDLE_H+BALL_R) {
    const offset = clamp((b.y-(room.p1+PADDLE_H/2))/(PADDLE_H/2), -1, 1);
    const speed = Math.min(Math.hypot(b.vx,b.vy)*1.075 + .25, 18);
    const angle = offset * 0.95;
    b.vx = Math.cos(angle)*speed; b.vy = Math.sin(angle)*speed;
    b.x = 42+BALL_R; room.lastHit = 1;
    io.to(room.players[0]).emit('fx:hit', {side:1});
  }
  if (b.vx > 0 && b.x+BALL_R >= W-42 && b.x < W-20 && b.y >= room.p2-BALL_R && b.y <= room.p2+PADDLE_H+BALL_R) {
    const offset = clamp((b.y-(room.p2+PADDLE_H/2))/(PADDLE_H/2), -1, 1);
    const speed = Math.min(Math.hypot(b.vx,b.vy)*1.075 + .25, 18);
    const angle = offset * 0.95;
    b.vx = -Math.cos(angle)*speed; b.vy = Math.sin(angle)*speed;
    b.x = W-42-BALL_R; room.lastHit = 2;
    io.to(room.players[1]).emit('fx:hit', {side:2});
  }
  // Bônus de energia aparece ocasionalmente no centro.
  room.powerTimer++;
  if (!room.powerup && room.powerTimer > 900 && Math.random() < .012) {
    room.powerup = { x: W/2, y: 75 + Math.random()*(H-150), type: Math.random()<.5?'boost':'slow' };
    room.powerTimer = 0;
  }
  if (room.powerup && Math.hypot(b.x-room.powerup.x,b.y-room.powerup.y)<22) {
    const type = room.powerup.type;
    if (type === 'boost') {
      const speed = Math.min(Math.hypot(b.vx,b.vy)*1.22, 19);
      const angle = Math.atan2(b.vy,b.vx); b.vx=Math.cos(angle)*speed; b.vy=Math.sin(angle)*speed;
    } else {
      const speed = Math.max(6, Math.hypot(b.vx,b.vy)*.78);
      const angle = Math.atan2(b.vy,b.vx); b.vx=Math.cos(angle)*speed; b.vy=Math.sin(angle)*speed;
    }
    io.to(room.id).emit('fx:power', {type});
    room.powerup = null;
  }
  if (b.x < -BALL_R) { room.score2++; io.to(room.id).emit('fx:point',{winner:2}); resetBall(room, 1); }
  if (b.x > W+BALL_R) { room.score1++; io.to(room.id).emit('fx:point',{winner:1}); resetBall(room, -1); }
}
setInterval(() => {
  for (const room of rooms.values()) {
    update(room);
    if (room.started) io.to(room.id).emit('state', snapshot(room));
  }
}, 1000/60);

io.on('connection', socket => {
  socket.on('match:find', () => {
    if (socket.roomId && rooms.has(socket.roomId)) return;
    // Reuse the oldest waiting match whose host is still connected.
    let room = null;
    while (waiting.length && !room) {
      const id = waiting.shift();
      const candidate = rooms.get(id);
      if (candidate && !candidate.started && candidate.players.length === 1 && io.sockets.sockets.has(candidate.players[0])) room = candidate;
    }
    if (room) joinRoom(socket, room.id);
    else {
      room = createRoom(socket);
      waiting.push(room.id);
    }
  });
  socket.on('match:join-link', id => joinRoom(socket, id));
  socket.on('paddle:set', y => {
    const room = rooms.get(socket.roomId);
    if (!room || !Number.isFinite(y)) return;
    const safeY = clamp(y, 0, H-PADDLE_H);
    if (socket.playerNum === 1) room.p1 = safeY;
    else if (socket.playerNum === 2) room.p2 = safeY;
  });
  socket.on('match:leave', () => leaveRoom(socket, true));
  socket.on('disconnect', () => leaveRoom(socket, false));
  function leaveRoom(s, notify) {
    const id = s.roomId;
    if (!id) return;
    const room = rooms.get(id);
    if (room) {
      if (notify) s.leave(id);
      io.to(id).emit('match:opponent-left');
      rooms.delete(id);
      const idx = waiting.indexOf(id); if (idx >= 0) waiting.splice(idx, 1);
    }
    s.roomId = null; s.playerNum = null;
  }
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Pong Neon Arena rodando na porta ${PORT}`));
