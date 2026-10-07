const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');

const LARGURA = 800;
const ALTURA = 600;

const SERVER_URL = (window.PONG_SERVER_URL || location.origin).replace(/\/$/, '');
const socket = typeof io === 'function' ? io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true
}) : null;

class SoundFX {
    constructor() { this.ctx = null; }
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    playTone(freq, type, duration, vol = 0.1) {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    }
    hitPaddle() { this.playTone(440, 'square', 0.1, 0.2); }
    hitWall() { this.playTone(220, 'sine', 0.08, 0.15); }
    score() { 
        this.playTone(587.33, 'triangle', 0.15, 0.25);
        setTimeout(() => this.playTone(880, 'triangle', 0.2, 0.25), 100);
    }
    menuSelect() { this.playTone(600, 'sine', 0.05, 0.1); }
}

const sounds = new SoundFX();

const EstadoJogo = {
    MENU_MODO: 0,
    MENU_TIPO_JOGO: 1,
    MENU_META_PONTOS: 2,
    MENU_OPCOES: 3,
    JOGANDO: 4,
    PAUSADO: 5,
    FIM_DE_JOGO: 6,
    ONLINE_LOBBY: 7,
    ONLINE_WAITING: 8,
    ONLINE_GAME: 9
};

let estadoAtual = EstadoJogo.MENU_MODO;
let modoBot = false, modoTreino = false, modoOnline = false;
let jogadorNum = 1, codigoSalaAtual = null;

let j1Y = 250, j2Y = 250;
let bolaX = 400, bolaY = 300, bolaXDir = 7, bolaYDir = 2;
let pontosJ1 = 0, pontosJ2 = 0;
let alturaRaquete = 100, tamanhoBola = 18;

let opcaoMenuModo = 0;
const $ = id => document.getElementById(id);

function toast(msg) {
    const e = $('toast');
    e.textContent = msg;
    e.classList.add('show');
    setTimeout(() => e.classList.remove('show'), 2200);
}

function gameLoop() {
    atualizar();
    desenhar();
    requestAnimationFrame(gameLoop);
}

function desenhar() {
    ctx.fillStyle = "#080814";
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    if (estadoAtual === EstadoJogo.MENU_MODO) {
        desenharMenuModo();
    } else if (estadoAtual === EstadoJogo.JOGANDO || estadoAtual === EstadoJogo.ONLINE_GAME) {
        desenharJogo();
    }
}

function desenharMenuModo() {
    ctx.font = "bold 38px Orbitron";
    ctx.fillStyle = "#00F0FF";
    ctx.textAlign = "center";
    ctx.fillText("PONG DAS 7 SOMBRAS", LARGURA / 2, 120);

    const ops = [
        "1 JOGADOR (VS BOT)",
        "2 JOGADORES (LOCAL)",
        "X1 ONLINE (MULTIPLAYER)",
        "MODO TREINO"
    ];

    for (let i = 0; i < ops.length; i++) {
        ctx.font = "20px Orbitron";
        ctx.fillStyle = (opcaoMenuModo === i) ? "#FF007F" : "#FFFFFF";
        ctx.fillText((opcaoMenuModo === i ? "> " : "  ") + ops[i], LARGURA / 2, 220 + (i * 50));
    }
}

function desenharJogo() {
    ctx.fillStyle = "#00F0FF";
    ctx.fillRect(30, j1Y, 14, alturaRaquete);

    ctx.fillStyle = "#FF007F";
    ctx.fillRect(LARGURA - 44, j2Y, 14, alturaRaquete);

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(bolaX, bolaY, tamanhoBola / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "36px Orbitron";
    ctx.fillText(pontosJ1, LARGURA / 2 - 80, 60);
    ctx.fillText(pontosJ2, LARGURA / 2 + 80, 60);
}

function atualizar() {
    if (estadoAtual !== EstadoJogo.JOGANDO) return;

    bolaX += bolaXDir;
    bolaY += bolaYDir;

    if (bolaY <= 0 || bolaY >= ALTURA) bolaYDir *= -1;

    if (bolaX <= 44 && bolaY >= j1Y && bolaY <= j1Y + alturaRaquete) bolaXDir *= -1;
    if (bolaX >= LARGURA - 44 && bolaY >= j2Y && bolaY <= j2Y + alturaRaquete) bolaXDir *= -1;

    if (bolaX < 0) { pontosJ2++; reiniciarBola(); }
    if (bolaX > LARGURA) { pontosJ1++; reiniciarBola(); }
}

function reiniciarBola() {
    bolaX = LARGURA / 2;
    bolaY = ALTURA / 2;
    bolaXDir *= -1;
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const y = (e.clientY - rect.top) * ALTURA / rect.height - alturaRaquete / 2;

    if (estadoAtual === EstadoJogo.JOGANDO) {
        j1Y = y;
    } else if (estadoAtual === EstadoJogo.ONLINE_GAME && socket) {
        if (jogadorNum === 1) j1Y = y;
        else j2Y = y;
        socket.emit('paddle:set', y);
    }
});

window.addEventListener('keydown', (e) => {
    sounds.init();
    if (estadoAtual === EstadoJogo.MENU_MODO) {
        if (e.code === "ArrowUp" || e.code === "KeyW") opcaoMenuModo = (opcaoMenuModo - 1 + 4) % 4;
        if (e.code === "ArrowDown" || e.code === "KeyS") opcaoMenuModo = (opcaoMenuModo + 1) % 4;
        if (e.code === "Enter" || e.code === "Space") {
            if (opcaoMenuModo === 0) { modoBot = true; estadoAtual = EstadoJogo.JOGANDO; }
            if (opcaoMenuModo === 1) { modoBot = false; estadoAtual = EstadoJogo.JOGANDO; }
            if (opcaoMenuModo === 2) abrirLobbyOnline();
            if (opcaoMenuModo === 3) { modoTreino = true; estadoAtual = EstadoJogo.JOGANDO; }
        }
    }
});

function abrirLobbyOnline() {
    modoOnline = true;
    estadoAtual = EstadoJogo.ONLINE_LOBBY;
    $('onlineScreen').classList.add('active');
    if (socket) socket.emit('rooms:list');
}

// Eventos de Interface X1
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
$('backBtn').onclick = () => {$('onlineScreen').classList.remove('active');
    estadoAtual = EstadoJogo.MENU_MODO;
};

$('copyBtn').onclick = () => {
    const link = `${location.origin}/?sala=${codigoSalaAtual}`;
    navigator.clipboard.writeText(link);
    toast('Link do X1 copiado!');
};

$('leaveBtn').onclick = () => {
    socket?.emit('room:leave');
    $('waitingScreen').classList.remove('active');
    estadoAtual = EstadoJogo.MENU_MODO;
};

// Eventos do Socket.io
if (socket) {
    socket.on('rooms:update', list => {
        $('roomsList').innerHTML = list.length ? list.map(r => `
            <div class="room-item">
                <span>${r.name} (${r.players}/2)</span>
                <button onclick="socket.emit('room:join', '${r.code}')">Entrar</button>
            </div>
        `).join('') : '<span class="muted">Nenhuma sala disponivel.</span>';
    });

    socket.on('room:created', d => {
        codigoSalaAtual = d.code;
        $('waitingName').textContent = d.name;
        $('waitingCode').textContent = d.code;
        $('onlineScreen').classList.remove('active');$('waitingScreen').classList.add('active');
        estadoAtual = EstadoJogo.ONLINE_WAITING;
    });

    socket.on('room:joined', d => {
        codigoSalaAtual = d.code;
        jogadorNum = d.player;
    });

    socket.on('match:start', s => {
        $('onlineScreen').classList.remove('active');$('waitingScreen').classList.remove('active');
        estadoAtual = EstadoJogo.ONLINE_GAME;
        toast(`X1 Iniciado! Voce e o Jogador ${jogadorNum}`);
    });

    socket.on('opponentMoved', d => {
        if (d.player === 1) j1Y = d.y;
        else j2Y = d.y;
    });

    socket.on('room:error', msg => toast(msg));
}

// Auto-Entrar por Link Directo (?sala=CODIGO)
const params = new URLSearchParams(location.search);
const directCode = params.get('sala') || params.get('room');
if (socket && directCode) {
    abrirLobbyOnline();
    setTimeout(() => socket.emit('room:join', directCode), 500);
}

gameLoop();