const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/join/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {};

function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
  socket.on('rooms:list', () => {
    const publicRooms = Object.values(rooms)
      .filter(r => r.public && r.players.length < 2)
      .map(r => ({ code: r.id, name: r.name, players: r.players.length }));
    socket.emit('rooms:update', publicRooms);
  });

  socket.on('room:create', (data = {}) => {
    let roomId = data.code || generateRoomId();
    while (rooms[roomId]) {
      roomId = generateRoomId();
    }

    rooms[roomId] = {
      id: roomId,
      name: data.name || `Sala ${roomId}`,
      public: data.public !== undefined ? data.public : true,
      players: [socket.id],
      j1Y: 250,
      j2Y: 250,
      pontosJ1: 0,
      pontosJ2: 0,
      bola: { x: 400, y: 300, vx: 7, vy: 2 },
      gameStarted: false
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerNum = 1;

    socket.emit('room:created', { code: roomId, name: rooms[roomId].name, player: 1 });
  });

  socket.on('room:join', (roomId) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('room:error', 'Sala nao encontrada!');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('room:error', 'Sala cheia!');
      return;
    }

    room.players.push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerNum = 2;

    socket.emit('room:joined', { code: roomId, player: 2 });
    
    io.to(roomId).emit('match:start', {
      p1: room.j1Y,
      p2: room.j2Y,
      score1: room.pontosJ1,
      score2: room.pontosJ2,
      ball: room.bola,
      running: true
    });
  });

  socket.on('paddle:set', (y) => {
    const room = rooms[socket.roomId];
    if (!room) return;

    if (socket.playerNum === 1) room.j1Y = y;
    else if (socket.playerNum === 2) room.j2Y = y;

    socket.to(socket.roomId).emit('opponentMoved', {
      player: socket.playerNum,
      y: y
    });
  });

  socket.on('updateGameState', (state) => {
    const room = rooms[socket.roomId];
    if (!room || socket.playerNum !== 1) return;

    room.bola = state.ball;
    room.pontosJ1 = state.score1;
    room.pontosJ2 = state.score2;

    socket.to(socket.roomId).emit('state', state);
  });

  socket.on('room:leave', () => {
    leaveRoom(socket);
  });

  socket.on('disconnect', () => {
    leaveRoom(socket);
  });

  function leaveRoom(s) {
    const roomId = s.roomId;
    if (roomId && rooms[roomId]) {
      io.to(roomId).emit('room:closed');
      delete rooms[roomId];
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});