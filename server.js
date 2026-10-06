
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/join/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {};

function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPublicRoomsList() {
  const publicRooms = [];
  for (const id in rooms) {
    if (rooms[id].isPublic && rooms[id].players.length < 2 && !rooms[id].gameStarted) {
      publicRooms.push({
        id: id,
        name: rooms[id].name || `Sala #${id}`,
        playersCount: rooms[id].players.length
      });
    }
  }
  return publicRooms;
}

io.on('connection', (socket) => {

  // Enviar lista de salas públicas
  socket.on('getPublicRooms', () => {
    socket.emit('publicRoomsList', getPublicRoomsList());
  });

  // Criar Sala (Pública ou Privada com Código Personalizado ou Automático)
  // Substitua o trecho de 'createRoom' e 'joinRoom' no server.js:

socket.on('createRoom', (data) => {
  let roomId = data?.customCode ? data.customCode.toString().trim().toUpperCase() : generateRoomId();
  const isPublic = data?.isPublic ?? true;
  const roomName = data?.roomName || `Sala de ${roomId}`;

  if (rooms[roomId]) {
    socket.emit('roomError', 'Este código/sala já existe! Escolha outro código.');
    return;
  }

  rooms[roomId] = {
    id: roomId,
    name: roomName,
    isPublic: isPublic,
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

  // Notifica o criador que a sala foi criada e aguarda o segundo jogador
  socket.emit('roomCreated', { roomId, playerNum: 1, isPublic });
  io.emit('publicRoomsList', getPublicRoomsList());
});

socket.on('joinRoom', (roomId) => {
  const cleanRoomId = roomId ? roomId.toString().trim().toUpperCase() : '';
  const room = rooms[cleanRoomId];

  if (!room) {
    socket.emit('roomError', 'Sala não encontrada!');
    return;
  }
  if (room.players.length >= 2) {
    socket.emit('roomError', 'Esta sala já está cheia!');
    return;
  }

  room.players.push(socket.id);
  socket.join(cleanRoomId);
  socket.roomId = cleanRoomId;
  socket.playerNum = 2;

  socket.emit('roomJoined', { roomId: cleanRoomId, playerNum: 2 });
  
  // Quando o segundo jogador entra, ambos são informados para iniciar a partida
  room.gameStarted = true;
  io.to(cleanRoomId).emit('gameStart', {
    j1Y: room.j1Y,
    j2Y: room.j2Y,
    bola: room.bola
  });

  io.emit('publicRoomsList', getPublicRoomsList());
});

  // Entrar em uma Sala por Código ou Seleção na Lista
  socket.on('joinRoom', (roomId) => {
    const cleanRoomId = roomId ? roomId.toString().trim().toUpperCase() : '';
    const room = rooms[cleanRoomId];

    if (!room) {
      socket.emit('roomError', 'Sala não encontrada!');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('roomError', 'Esta sala já está cheia!');
      return;
    }

    room.players.push(socket.id);
    socket.join(cleanRoomId);
    socket.roomId = cleanRoomId;
    socket.playerNum = 2;

    socket.emit('roomJoined', { roomId: cleanRoomId, playerNum: 2 });
    io.to(cleanRoomId).emit('gameStart', {
      j1Y: room.j1Y,
      j2Y: room.j2Y,
      bola: room.bola
    });

    io.emit('publicRoomsList', getPublicRoomsList());
  });

  // Movimento da Raquete
  socket.on('movePaddle', (y) => {
    const room = rooms[socket.roomId];
    if (!room) return;

    if (socket.playerNum === 1) room.j1Y = y;
    else if (socket.playerNum === 2) room.j2Y = y;

    socket.to(socket.roomId).emit('opponentMoved', {
      playerNum: socket.playerNum,
      y: y
    });
  });

  // Sincronização do Estado do Jogo (Host / Jogador 1)
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
      io.emit('publicRoomsList', getPublicRoomsList());
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(` Servidor rodando em http://localhost:${PORT}`);
});