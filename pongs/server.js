const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Rota amigável para entrar diretamente por link (ex: /join/123456)
app.get('/join/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {};

function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
  // Criar Sala
  socket.on('createRoom', () => {
    let roomId = generateRoomId();
    while (rooms[roomId]) {
      roomId = generateRoomId();
    }

    rooms[roomId] = {
      id: roomId,
      players: [socket.id],
      j1Y: 250,
      j2Y: 250,
      pontosJ1: 0,
      pontosJ2: 0,
      bola: { x: 400, y: 300, vx: 7, vy: 7 },
      gameStarted: false
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerNum = 1;

    socket.emit('roomCreated', { roomId, playerNum: 1 });
  });

  // Entrar em Sala
  socket.on('joinRoom', (roomId) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('roomError', 'Sala não encontrada!');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('roomError', 'Sala cheia!');
      return;
    }

    room.players.push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerNum = 2;

    socket.emit('roomJoined', { roomId, playerNum: 2 });
    io.to(roomId).emit('gameStart', {
      j1Y: room.j1Y,
      j2Y: room.j2Y,
      bola: room.bola
    });
  });

  // Mover Raquete
  socket.on('movePaddle', (y) => {
    const room = rooms[socket.roomId];
    if (!room) return;

    if (socket.playerNum === 1) {
      room.j1Y = y;
    } else if (socket.playerNum === 2) {
      room.j2Y = y;
    }

    socket.to(socket.roomId).emit('opponentMoved', {
      playerNum: socket.playerNum,
      y: y
    });
  });

  // Sincronização do Estado / Bola pelo Host (Jogador 1)
  socket.on('updateGameState', (state) => {
    const room = rooms[socket.roomId];
    if (!room || socket.playerNum !== 1) return;

    room.bola = state.bola;
    room.pontosJ1 = state.pontosJ1;
    room.pontosJ2 = state.pontosJ2;

    socket.to(socket.roomId).emit('syncGameState', state);
  });

  // Desconexão
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      io.to(roomId).emit('playerDisconnected');
      delete rooms[roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});