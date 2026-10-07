const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 800, H = 600;

const SERVER_URL = (window.PONG_SERVER_URL || location.origin).replace(/\/$/, '');
const socket = typeof io === 'function' ? io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  timeout: 8000
}) : null;

const $ = id => document.getElementById(id);
const screens = ['home', 'online', 'waiting', 'result'];

let mode = 'menu', online = false, player = 0, room = null;
let state = { p1: 250, p2: 250, score1: 0, score2: 0, ball: { x: 400, y: 300, vx: 7, vy: 2 }, running: false };
let renderState = structuredClone(state), lastServerAt = performance.now(), lastFrame = performance.now();
let local = { p1: 250, p2: 250, ball: { x: 400, y: 300, vx: 7, vy: 2 }, s1: 0, s2: 0 }, botY = 250, mouseY = 250, keys = {};
let particles = [];
let lastPaddleSent = 0, lastSentY = null;

function screen(id) {
  screens.forEach(x => $(x).classList.toggle('active', x === id));
}

function toast(t) {
  const e = $('toast');
  e.textContent = t;
  e.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => e.classList.remove('show'), 2200);
}

function menu() {
  mode = 'menu';
  online = false;
  screen('home');
}

function startLocal(vsBot) {
  mode = vsBot ? 'bot' : 'local';
  online = false;
  local = { p1: 250, p2: 250, ball: { x: 400, y: 300, vx: 7, vy: Math.random() * 5 - 2.5 }, s1: 0, s2: 0 };
  screen('home');
  screens.forEach(x => $(x).classList.remove('active'));
}

function startOnline() {
  mode = 'onlineLobby';
  online = true;
  screen('online');
  if (socket) socket.emit('rooms:list');
}

function drawBg() {
  ctx.fillStyle = '#090514';
  ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(400, 280, 20, 400, 300, 500);
  g.addColorStop(0, '#1e0b36');
  g.addColorStop(1, '#090514');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#a855f715';
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  ctx.setLineDash([8, 12]);
  ctx.strokeStyle = '#a855f740';
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);
}

function glowRect(x, y, w, h, c) {
  ctx.save();
  ctx.shadowColor = c;
  ctx.shadowBlur = 18;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 7);
  ctx.fill();
  ctx.restore();
}

function drawGame(s) {
  drawBg();
  ctx.fillStyle = '#f3e8ff';
  ctx.font = '700 56px Orbitron';
  ctx.textAlign = 'center';
  ctx.globalAlpha = .8;
  ctx.fillText(s.score1, 350, 72);
  ctx.fillText(s.score2, 450, 72);
  ctx.globalAlpha = 1;

  ctx.font = '9px Space Mono';
  ctx.fillStyle = '#a78bfa';
  ctx.fillText('META: 7 PONTOS', 400, 92);

  glowRect(24, s.p1, 14, 96, '#38bdf8');
  glowRect(762, s.p2, 14, 96, '#a855f7');

  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.shadowColor = '#f3e8ff';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s.ball.x, s.ball.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (!s.running) {
    ctx.textAlign = 'center';
    ctx.font = '700 14px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText(online ? 'AGUARDANDO JOGADOR...' : 'CLIQUE PARA SACAR', 400, 310);
  }
}

function localStep(dt) {
  const speed = 10;
  if (keys.w) local.p1 = Math.max(20, local.p1 - speed * dt);
  if (keys.s) local.p1 = Math.min(484, local.p1 + speed * dt);
  if (keys.ArrowUp) local.p2 = Math.max(20, local.p2 - speed * dt);
  if (keys.ArrowDown) local.p2 = Math.min(484, local.p2 + speed * dt);

  if (mode === 'bot') {
    let target = local.ball.y - 48;
    botY += (target - botY) * Math.min(.07 * dt, 1);
    local.p2 = botY;
  }

  let b = local.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.y < 10 || b.y > 590) {
    b.vy *= -1;
    b.y = Math.max(10, Math.min(590, b.y));
  }

  if (b.x < 45 && b.x > 24 && b.y > local.p1 - 4 && b.y < local.p1 + 100 && b.vx < 0) {
    b.vx = Math.min(Math.abs(b.vx) * 1.04 + .12, 15);
    b.vy += (b.y - local.p1 - 50) / 18;
    b.x = 45;
    hit(b.x, b.y, '#38bdf8');
  }

  if (b.x > 755 && b.x < 776 && b.y > local.p2 - 4 && b.y < local.p2 + 100 && b.vx > 0) {
    b.vx = -Math.min(Math.abs(b.vx) * 1.04 + .12, 15);
    b.vy += (b.y - local.p2 - 50) / 18;
    b.x = 755;
    hit(b.x, b.y, '#a855f7');
  }

  if (b.x < -20) { local.s2++; serve(local, 1); }
  if (b.x > 820) { local.s1++; serve(local, -1); }
}

function serve(s, dir) {
  if (s.s1 >= 7 || s.s2 >= 7) {
    $('winner').textContent = (s.s1 >= 7 ? 'JOGADOR 1' : 'JOGADOR 2') + ' VENCEU';$('finalScore').textContent = `${s.s1} — ${s.s2}`;
    screen('result');
    mode = 'result';
    return;
  }
  s.ball = { x: 400, y: 300, vx: 7 * dir, vy: Math.random() * 5 - 2.5 };
}

function hit(x, y, c) {
  for (let i = 0; i < 10; i++) {
    particles.push({ x, y, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4, life: 1, c });
  }
}

function updateParticles(dt) {
  particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= .045 * dt; });
  particles = particles.filter(p => p.life > 0);
}

function smoothOnline(dt) {
  const a = Math.min(1, dt * 0.32);
  renderState.p1 += (state.p1 - renderState.p1) * a;
  renderState.p2 += (state.p2 - renderState.p2) * a;

  if (player === 1) renderState.p1 = state.p1;
  else if (player === 2) renderState.p2 = state.p2;

  renderState.score1 = state.score1;
  renderState.score2 = state.score2;
  renderState.running = state.running;

  const elapsed = Math.min((performance.now() - lastServerAt) / 16.6667, 2);
  const predictedX = state.ball.x + state.ball.vx * elapsed;
  const predictedY = state.ball.y + state.ball.vy * elapsed;

  const correction = Math.min(1, dt * 0.45);
  renderState.ball.x += (predictedX - renderState.ball.x) * correction;
  renderState.ball.y += (predictedY - renderState.ball.y) * correction;
  renderState.ball.vx = state.ball.vx;
  renderState.ball.vy = state.ball.vy;
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 16.6667, 2);
  lastFrame = now;
  updateParticles(dt);

  if (mode === 'local' || mode === 'bot') {
    localStep(dt);
    drawGame({ p1: local.p1, p2: local.p2, score1: local.s1, score2: local.s2, ball: local.ball, running: true });
  } else if (mode === 'onlineGame') {
    smoothOnline(dt);
    drawGame(renderState);
  } else {
    drawBg();
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  const y = (e.clientY - r.top) * H / r.height;
  mouseY = Math.max(20, Math.min(484, y - 48));

  if (mode === 'onlineGame' && online && socket) {
    if (player === 1) renderState.p1 = mouseY;
    else if (player === 2) renderState.p2 = mouseY;

    const now = performance.now();
    if (now - lastPaddleSent >= 33 && (lastSentY === null || Math.abs(mouseY - lastSentY) >= 1)) {
      socket.volatile.emit('paddle:set', mouseY);
      lastPaddleSent = now;
      lastSentY = mouseY;
    }
  } else if (mode === 'local' || mode === 'bot') {
    if (mode === 'local') local.p1 = mouseY;
    else local.p2 = mouseY;
  }
});

window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  if (e.key === 'Escape' && mode !== 'menu') menu();
});

window.addEventListener('keyup', e => keys[e.key] = false);

document.querySelectorAll('[data-action]').forEach(b => b.onclick = () => {
  const a = b.dataset.action;
  if (a === 'home') menu();
  if (a === 'local') startLocal(false);
  if (a === 'bot') startLocal(true);
  if (a === 'online') startOnline();
});

document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tabbody').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $(b.dataset.tab).classList.add('active');
});

$('createBtn').onclick = () => {
  if (!socket) return toast('Servidor offline');
  socket.emit('room:create', { code: $('roomCode').value, name: $('roomName').value, public:$('roomPublic').checked });
};

$('joinBtn').onclick = () => {
  if (!socket) return toast('Servidor offline');
  socket.emit('room:join', $('joinCode').value);
};

$('refresh').onclick = () => socket?.emit('rooms:list');

$('leave').onclick = () => {
  socket?.emit('room:leave');
  menu();
};

$('copy').onclick = () => {
  const link = location.origin + '/?sala=' + encodeURIComponent(room);
  navigator.clipboard?.writeText(link);
  toast('Link copiado!');
};

$('again').onclick = () => {
  if (online) {
    socket?.emit('room:create', {});
  } else {
    startLocal(false);
  }
};

function showWaiting(d) {
  room = d.code;
  screen('waiting');
  $('waitingName').textContent = d.name;
  $('waitingCode').textContent = d.code;
  mode = 'waiting';
}

if (socket) {
  socket.on('connect', () => {
    $('net').textContent = '● ONLINE';
    $('net').className = 'net online';
  });

  socket.on('disconnect', () => {
    $('net').textContent = '● OFFLINE';
    $('net').className = 'net offline';
    if (online) toast('Conexão com o servidor perdida');
  });

  socket.on('rooms:update', list => {
    $('roomsList').innerHTML = list.length ? list.map(r => `
      <div class="room">
        <span>${escapeHtml(r.name)}<br><small>${r.players}/2 • ${r.code}</small></span>
        <button data-room="${r.code}">ENTRAR</button>
      </div>`).join('') : '<span class="muted">Nenhuma sala disponível.</span>';

    document.querySelectorAll('[data-room]').forEach(b => b.onclick = () => socket.emit('room:join', b.dataset.room));
  });

  socket.on('room:created', d => showWaiting(d));
  socket.on('room:joined', d => { room = d.code; player = d.player; });
  socket.on('room:error', m => toast(m));

  socket.on('match:start', s => {
    state = s;
    renderState = structuredClone(s);
    lastServerAt = performance.now();
    mode = 'onlineGame';
    online = true;
    screens.forEach(x => $(x).classList.remove('active'));
    toast(`Você é o Jogador ${player}`);
  });

  socket.on('state', s => {
    state = s;
    lastServerAt = performance.now();
    if (Math.abs(state.ball.x - renderState.ball.x) > 90 || Math.abs(state.ball.y - renderState.ball.y) > 90) {
      renderState.ball.x = state.ball.x;
      renderState.ball.y = state.ball.y;
    }
  });

  socket.on('room:closed', () => {
    if (online) {
      toast('A sala foi encerrada');
      menu();
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Entrar automaticamente se houver link com ?sala=CODIGO ou ?room=CODIGO
const params = new URLSearchParams(location.search);
const directCode = params.get('sala') || params.get('room') || (location.pathname.startsWith('/join/') ? decodeURIComponent(location.pathname.split('/').pop()) : '');
if (socket && directCode) {
  startOnline();
  setTimeout(() => socket.emit('room:join', directCode), 500);
}