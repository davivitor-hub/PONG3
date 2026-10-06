const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');

// Elementos da UI Overlays
const multiplayerUI = document.getElementById('multiplayerUI');
const cardCreateRoom = document.getElementById('cardCreateRoom');
const cardWaitingRoom = document.getElementById('cardWaitingRoom');
const cardJoinRoom = document.getElementById('cardJoinRoom');

const inputCustomCode = document.getElementById('inputCustomCode');
const checkIsPublic = document.getElementById('checkIsPublic');
const btnConfirmCreate = document.getElementById('btnConfirmCreate');
const btnBackFromCreate = document.getElementById('btnBackFromCreate');

const uiRoomCode = document.getElementById('uiRoomCode');
const btnCopyCode = document.getElementById('btnCopyCode');
const btnCopyLink = document.getElementById('btnCopyLink');
const btnCancelRoom = document.getElementById('btnCancelRoom');

const inputJoinCode = document.getElementById('inputJoinCode');
const btnConfirmJoin = document.getElementById('btnConfirmJoin');
const publicRoomsList = document.getElementById('publicRoomsList');
const uiErrorMessage = document.getElementById('uiErrorMessage');
const btnBackFromJoin = document.getElementById('btnBackFromJoin');

// Socket.io
const socket = typeof io !== 'undefined' ? io() : null;

// Dimensões do Canvas
const LARGURA = 800;
const ALTURA = 600;

// Sistema de Som Sintetizado (Web Audio API)
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

// Estados do Jogo
const EstadoJogo = {
    MENU_MODO: 0,
    MENU_TIPO_JOGO: 1,
    MENU_META_PONTOS: 2,
    MENU_OPCOES: 3,
    JOGANDO: 4,
    PAUSADO: 5,
    FIM_DE_JOGO: 6,
    MENU_ONLINE: 7
};

let estadoAtual = EstadoJogo.MENU_MODO;
let estadoAnteriorOpcoes = EstadoJogo.MENU_MODO;

// Configurações de Modos
let modoBot = false;
let modoTreino = false;
let modoOnline = false;
let meuNumeroJogador = 1;
let codigoSalaOnline = "";
let temPartidaSalva = false;

const TipoJogo = { PONTOS_DEFINIDOS: 0, INFINITO: 1 };
let tipoJogoAtual = TipoJogo.PONTOS_DEFINIDOS;

const Dificuldade = { FACIL: 0, MEDIO: 1, DIFICIL: 2, FRENESI: 3 };
let dificuldadeAtual = Dificuldade.MEDIO;
const NOMES_DIFICULDADE = ["Fácil", "Médio", "Difícil", "Frenesi"];

const OPCOES_PONTOS = [3, 5, 10, 15, 20];
let indiceOpcaoPontos = 1;
let pontosParaVencer = 5;

// Seleções dos Menus
let opcaoMenuModo = 0;
let opcaoMenuTipoJogo = 0;
let opcaoMenuOpcoes = 0;
let opcaoMenuPausa = 0;

// Mapeamento de Teclas
let teclaJ1Cima = "KeyW", teclaJ1Baixo = "KeyS";
let teclaJ2Cima = "ArrowUp", teclaJ2Baixo = "ArrowDown";

let mouseAtivo = true, jogadorMouse = 1;

// Cores Neon Disponíveis
const CORES_DISPONIVEIS = ["#00F0FF", "#FF007F", "#39FF14", "#FFE600", "#FF5E00", "#BF00FF", "#FFFFFF", "#00FFAB"];
const NOMES_CORES = ["Ciano Neon", "Rosa Neon", "Verde Neon", "Amarelo Neon", "Laranja", "Roxo", "Branco", "Menta"];

let idxCorJ1 = 0, idxCorJ2 = 1, idxCorBola = 6;
let corJ1 = CORES_DISPONIVEIS[0], corJ2 = CORES_DISPONIVEIS[1], corBola = CORES_DISPONIVEIS[6];

// Tamanhos e Velocidades
const OPCOES_TAM_RAQUETE = [60, 100, 140];
const NOMES_TAM_RAQUETE = ["Pequena", "Média", "Grande"];
let idxTamRaquete = 1, alturaRaquete = 100;

const OPCOES_TAM_BOLA = [12, 18, 26];
const NOMES_TAM_BOLA = ["Pequena", "Média", "Grande"];
let idxTamBola = 1, tamanhoBola = 18;

const OPCOES_VEL_RAQUETE = [7, 10, 14];
const NOMES_VEL_RAQUETE = ["Lenta", "Média", "Rápida"];
let idxVelRaquete = 1, velocidadeRaquete = 10;

const LARGURA_RAQUETE = 14;

let velocidadeBolaAtual = 7.0, velocidadeBolaBase = 7.0;
let velocidadeBot = 7, suavizacaoBot = 0.08;
let bolaEsperandoInicio = false;

// Posições e Objetos
let j1Y = 250, j2Y = 250;
let bolaX = 400, bolaY = 300;
let bolaXDir = 7, bolaYDir = 7;

let pontosJ1 = 0, pontosJ2 = 0;
let rebatesTreinoAtual = 0, recordeTreino = 0;

let j1Cima = false, j1Baixo = false, j2Cima = false, j2Baixo = false;
let mousePos = { x: 0, y: 0 };

// Efeitos Visuais
let rastroBola = [], particulas = [], estrelasFundo = [];
let offsetGrade = 0, shakeIntensity = 0;

for (let i = 0; i < 40; i++) {
    estrelasFundo.push({
        x: Math.random() * LARGURA,
        y: Math.random() * ALTURA,
        size: Math.random() * 2,
        alpha: Math.random()
    });
}

// Controladores da UI Overlay
function abrirLobbyOnline() {
    modoOnline = true;
    modoBot = false;
    modoTreino = false;
    estadoAtual = EstadoJogo.MENU_ONLINE;
    ocultarTodasOverlays();
    multiplayerUI.classList.remove('hidden');
    cardJoinRoom.classList.remove('hidden');
    if (socket) socket.emit('getPublicRooms');
}

function abrirCriarSala() {
    modoOnline = true;
    modoBot = false;
    modoTreino = false;
    estadoAtual = EstadoJogo.MENU_ONLINE;
    ocultarTodasOverlays();
    multiplayerUI.classList.remove('hidden');
    cardCreateRoom.classList.remove('hidden');
}

function ocultarTodasOverlays() {
    multiplayerUI.classList.add('hidden');
    cardCreateRoom.classList.add('hidden');
    cardWaitingRoom.classList.add('hidden');
    cardJoinRoom.classList.add('hidden');
    uiErrorMessage.innerText = "";
}

// Configuração de Eventos do Socket.io
if (socket) {
    socket.on('roomCreated', (data) => {
        codigoSalaOnline = data.roomId;
        meuNumeroJogador = data.playerNum;
        
        ocultarTodasOverlays();
        multiplayerUI.classList.remove('hidden');
        cardWaitingRoom.classList.remove('hidden');
        uiRoomCode.innerText = data.roomId;
        
        estadoAtual = EstadoJogo.MENU_ONLINE;
    });

    socket.on('roomJoined', (data) => {
        codigoSalaOnline = data.roomId;
        meuNumeroJogador = data.playerNum;
        ocultarTodasOverlays();
    });

    socket.on('gameStart', (data) => {
        ocultarTodasOverlays();
        modoOnline = true; modoBot = false; modoTreino = false;
        j1Y = Number.isFinite(data.j1Y) ? data.j1Y : j1Y;
        j2Y = Number.isFinite(data.j2Y) ? data.j2Y : j2Y;
        pontosJ1 = data.pontosJ1 || 0; pontosJ2 = data.pontosJ2 || 0;
        if (data.bola) { bolaX=data.bola.x; bolaY=data.bola.y; bolaXDir=data.bola.vx; bolaYDir=data.bola.vy; }
        bolaEsperandoInicio = data.bolaEsperandoInicio !== false;
        rastroBola=[]; estadoAtual=EstadoJogo.JOGANDO;
    });

    socket.on('roomError', (msg) => {
        uiErrorMessage.innerText = msg;
        if (!cardCreateRoom.classList.contains('hidden')) {
            abrirLobbyOnline();
            uiErrorMessage.innerText = msg;
        }
    });

    socket.on('publicRoomsList', (rooms) => {
        publicRoomsList.innerHTML = "";
        if (!rooms || rooms.length === 0) {
            publicRoomsList.innerHTML = '<p class="no-rooms">Nenhuma sala pública aberta no momento...</p>';
            return;
        }

        rooms.forEach((r) => {
            const div = document.createElement('div');
            div.className = 'room-item';
            div.innerHTML = `
                <span>${r.name} (${r.playersCount}/2)</span>
                <button class="glow-btn" onclick="entrarEmSalaPublica('${r.id}')">Entrar</button>
            `;
            publicRoomsList.appendChild(div);
        });
    });

    socket.on('opponentMoved', (data) => {
        if (data.playerNum === 1) j1Y = data.y;
        else if (data.playerNum === 2) j2Y = data.y;
    });

    socket.on('syncGameState', (data) => {
        if (meuNumeroJogador === 2) {
            bolaX = data.bola.x;
            bolaY = data.bola.y;
            bolaXDir = data.bola.vx;
            bolaYDir = data.bola.vy;
            pontosJ1 = data.pontosJ1;
            pontosJ2 = data.pontosJ2;
            bolaEsperandoInicio = data.bolaEsperandoInicio;
        }
    });

    socket.on('playerDisconnected', () => {
        if (estadoAtual === EstadoJogo.JOGANDO) {
            alert('O outro jogador desconectou-se.');
            ocultarTodasOverlays();
            modoOnline = false;
            estadoAtual = EstadoJogo.MENU_MODO;
        }
    });

    // Detetar link direto /join/CODIGO
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'join' && pathParts[2]) {
        abrirLobbyOnline();
        socket.emit('joinRoom', pathParts[2]);
    }
}

window.entrarEmSalaPublica = function(roomId) {
    if (socket) socket.emit('joinRoom', roomId);
};

// Eventos de Cliques dos Botões do Overlay
btnConfirmCreate.addEventListener('click', () => {
    const customCode = inputCustomCode.value.trim().toUpperCase();
    const isPublic = checkIsPublic.checked;
    if (socket) {
        socket.emit('createRoom', { customCode, isPublic });
    }
});

btnBackFromCreate.addEventListener('click', abrirLobbyOnline);

btnConfirmJoin.addEventListener('click', () => {
    const code = inputJoinCode.value.trim().toUpperCase();
    if (code && socket) {
        socket.emit('joinRoom', code);
    }
});

btnCopyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(codigoSalaOnline).then(() => {
        btnCopyCode.innerText = "Copiado!";
        setTimeout(() => btnCopyCode.innerText = "Copiar Código", 2000);
    });
});

btnCopyLink.addEventListener('click', () => {
    const link = `${window.location.origin}/join/${codigoSalaOnline}`;
    navigator.clipboard.writeText(link).then(() => {
        btnCopyLink.innerText = "Link Copiado!";
        setTimeout(() => btnCopyLink.innerText = "Copiar Link Direto", 2000);
    });
});

btnCancelRoom.addEventListener('click', () => {
    if (socket) socket.emit('leaveRoom');
    codigoSalaOnline = ''; modoOnline = false;
    ocultarTodasOverlays(); estadoAtual = EstadoJogo.MENU_MODO;
});

btnBackFromJoin.addEventListener('click', () => {
    ocultarTodasOverlays();
    modoOnline = false;
    estadoAtual = EstadoJogo.MENU_MODO;
});

function addScreenShake(amount) { shakeIntensity = amount; }

function applyScreenShake() {
    if (shakeIntensity > 0) {
        let dx = (Math.random() - 0.5) * shakeIntensity;
        let dy = (Math.random() - 0.5) * shakeIntensity;
        container.style.transform = `translate(${dx}px, ${dy}px)`;
        shakeIntensity -= 0.5;
        if (shakeIntensity < 0) shakeIntensity = 0;
    } else {
        container.style.transform = 'translate(0px, 0px)';
    }
}

function gameLoop() {
    atualizar();
    desenhar();
    applyScreenShake();
    requestAnimationFrame(gameLoop);
}

function criarParticulas(x, y, cor, qtd = 15) {
    for (let i = 0; i < qtd; i++) {
        let angulo = Math.random() * Math.PI * 2;
        let vel = Math.random() * 5 + 2;
        particulas.push({
            x: x, y: y,
            vx: Math.cos(angulo) * vel,
            vy: Math.sin(angulo) * vel,
            cor: cor, vida: 1.0,
            tamanho: Math.random() * 4 + 2
        });
    }
}

function desenharFundoAnimado() {
    ctx.fillStyle = "#080814";
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    for (let est of estrelasFundo) {
        est.alpha += (Math.random() - 0.5) * 0.05;
        if (est.alpha < 0.2) est.alpha = 0.2;
        if (est.alpha > 1) est.alpha = 1;
        ctx.fillStyle = `rgba(255, 255, 255, ${est.alpha})`;
        ctx.fillRect(est.x, est.y, est.size, est.size);
    }

    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= LARGURA; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ALTURA);
        ctx.stroke();
    }

    offsetGrade = (offsetGrade + 0.5) % 40;
    for (let y = offsetGrade; y <= ALTURA; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(LARGURA, y);
        ctx.stroke();
    }
    ctx.restore();
}

function desenhar() {
    desenharFundoAnimado();

    switch (estadoAtual) {
        case EstadoJogo.MENU_MODO: desenharMenuModo(); break;
        case EstadoJogo.MENU_TIPO_JOGO: desenharMenuTipoJogo(); break;
        case EstadoJogo.MENU_META_PONTOS: desenharMenuMetaPontos(); break;
        case EstadoJogo.MENU_OPCOES: desenharMenuOpcoes(); break;
        case EstadoJogo.JOGANDO: desenharJogo(); break;
        case EstadoJogo.PAUSADO:
            desenharJogo();
            desenharMenuPausa();
            break;
        case EstadoJogo.FIM_DE_JOGO: desenharFimDeJogo(); break;
    }
}

function desenharTextoGlow(texto, x, y, cor, tamanho = 24, align = "center", glowSize = 15) {
    ctx.save();
    ctx.font = `bold ${tamanho}px Orbitron`;
    ctx.textAlign = align;
    ctx.shadowColor = cor;
    ctx.shadowBlur = glowSize;
    ctx.fillStyle = cor;
    ctx.fillText(texto, x, y);
    ctx.restore();
}

function desenharMenuModo() {
    desenharTextoGlow("PONG DAS 7 SOMBRAS", LARGURA / 2, 80, "#00F0FF", 42, "center", 25);

    const ops = [
        temPartidaSalva ? "CONTINUAR PARTIDA" : "[ SEM PARTIDA SALVA ]",
        "1 JOGADOR (VS BOT)",
        "2 JOGADORES (LOCAL)",
        "CRIAR SALA ONLINE",
        "LOBBY / ENTRAR EM SALA",
        "MODO TREINO (SOLO)",
        "OPÇÕES DO JOGO"
    ];

    for (let i = 0; i < ops.length; i++) {
        let cor = (i === 0 && !temPartidaSalva) ? "#444" : (opcaoMenuModo === i ? "#FF007F" : "#FFFFFF");
        let prefixo = opcaoMenuModo === i ? "> " : "  ";
        desenharTextoGlow(prefixo + ops[i], LARGURA / 2, 170 + (i * 42), cor, 18, "center", opcaoMenuModo === i ? 15 : 0);
    }
}

function desenharMenuOpcoes() {
    desenharTextoGlow("CONFIGURAÇÕES", LARGURA / 2, 50, "#00F0FF", 32, "center", 20);

    const ops = [
        "Dificuldade: < " + NOMES_DIFICULDADE[dificuldadeAtual] + " >",
        "Ativar Mouse: < " + (mouseAtivo ? "Sim" : "Não") + " >",
        "Jogador com Mouse: < Jogador " + jogadorMouse + " >",
        "Cor Raquete J1: < " + NOMES_CORES[idxCorJ1] + " >",
        "Cor Raquete J2: < " + NOMES_CORES[idxCorJ2] + " >",
        "Cor da Bola: < " + NOMES_CORES[idxCorBola] + " >",
        "Tamanho Raquete: < " + NOMES_TAM_RAQUETE[idxTamRaquete] + " >",
        "Tamanho Bola: < " + NOMES_TAM_BOLA[idxTamBola] + " >",
        "Velocidade Raquete: < " + NOMES_VEL_RAQUETE[idxVelRaquete] + " >",
        "Mapear J1 Subir: [ " + teclaJ1Cima + " ]",
        "Mapear J1 Descer: [ " + teclaJ1Baixo + " ]",
        "Mapear J2 Subir: [ " + teclaJ2Cima + " ]",
        "Mapear J2 Descer: [ " + teclaJ2Baixo + " ]",
        "VOLTAR"
    ];

    ctx.font = "13px Orbitron";
    ctx.textAlign = "left";
    for (let i = 0; i < ops.length; i++) {
        let cor = opcaoMenuOpcoes === i ? "#FFE600" : "#FFFFFF";
        let prefixo = opcaoMenuOpcoes === i ? "► " : "  ";
        desenharTextoGlow(prefixo + ops[i], 80, 85 + (i * 28), cor, 13, "left", opcaoMenuOpcoes === i ? 10 : 0);
    }
}

function desenharMenuTipoJogo() {
    desenharTextoGlow("TIPO DE PARTIDA", LARGURA / 2, 170, "#00F0FF", 36);

    const ops = ["PARTIDA POR PONTOS", "MODO INFINITO"];
    for (let i = 0; i < ops.length; i++) {
        let cor = opcaoMenuTipoJogo === i ? "#FF007F" : "#FFFFFF";
        let prefixo = opcaoMenuTipoJogo === i ? "> " : "  ";
        desenharTextoGlow(prefixo + ops[i], LARGURA / 2, 270 + (i * 60), cor, 22);
    }
}

function desenharMenuMetaPontos() {
    desenharTextoGlow("META DE PONTOS", LARGURA / 2, 140, "#00F0FF", 36);

    for (let i = 0; i < OPCOES_PONTOS.length; i++) {
        let cor = indiceOpcaoPontos === i ? "#FF007F" : "#FFFFFF";
        let prefixo = indiceOpcaoPontos === i ? "> " : "  ";
        desenharTextoGlow(prefixo + OPCOES_PONTOS[i] + " PONTOS", LARGURA / 2, 220 + (i * 48), cor, 20);
    }
}

function desenharJogo() {
    ctx.save();
    if (!modoTreino) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 4;
        ctx.setLineDash([15, 15]);
        ctx.beginPath();
        ctx.moveTo(LARGURA / 2, 0);
        ctx.lineTo(LARGURA / 2, ALTURA);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = corJ1;
    ctx.shadowBlur = 20;
    ctx.fillStyle = corJ1;
    ctx.fillRect(30, j1Y, LARGURA_RAQUETE, alturaRaquete);

    if (!modoTreino) {
        ctx.shadowColor = corJ2;
        ctx.shadowBlur = 20;
        ctx.fillStyle = corJ2;
        ctx.fillRect(LARGURA - 30 - LARGURA_RAQUETE, j2Y, LARGURA_RAQUETE, alturaRaquete);
    } else {
        ctx.shadowColor = corJ2;
        ctx.shadowBlur = 20;
        ctx.fillStyle = corJ2;
        ctx.fillRect(LARGURA - 10, 0, 10, ALTURA);
    }
    ctx.restore();

    for (let i = 0; i < rastroBola.length; i++) {
        let p = rastroBola[i];
        let alpha = (i + 1) / rastroBola.length * 0.4;
        ctx.save();
        ctx.fillStyle = corBola;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (tamanhoBola / 2) * (i / rastroBola.length), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    for (let i = particulas.length - 1; i >= 0; i--) {
        let pt = particulas[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vida -= 0.03;

        if (pt.vida <= 0) {
            particulas.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = pt.vida;
        ctx.shadowColor = pt.cor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = pt.cor;
        ctx.fillRect(pt.x, pt.y, pt.tamanho, pt.tamanho);
        ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = corBola;
    ctx.shadowBlur = 25;
    ctx.fillStyle = corBola;
    ctx.beginPath();
    ctx.arc(bolaX + tamanhoBola / 2, bolaY + tamanhoBola / 2, tamanhoBola / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (modoTreino) {
        desenharTextoGlow("REBATES: " + rebatesTreinoAtual, 200, 50, "#00F0FF", 20);
        desenharTextoGlow("RECORDE: " + recordeTreino, 600, 50, "#FF007F", 20);
    } else {
        desenharTextoGlow("" + pontosJ1, LARGURA / 2 - 80, 70, corJ1, 48);
        desenharTextoGlow("" + pontosJ2, LARGURA / 2 + 80, 70, corJ2, 48);
    }

    if (modoOnline) {
        desenharTextoGlow(`SALA: ${codigoSalaOnline} | VOCÊ É O JOGADOR ${meuNumeroJogador}`, LARGURA / 2, 25, "#39FF14", 12);
    }

    if (bolaEsperandoInicio) {
        desenharTextoGlow("CLIQUE OU PRESSIONE UMA TECLA PARA COMEÇAR", LARGURA / 2, 140, "#FFE600", 16, "center", 10);
    }
}

function desenharMenuPausa() {
    ctx.fillStyle = "rgba(5, 5, 15, 0.85)";
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    desenharTextoGlow("PAUSA", LARGURA / 2, 180, "#00F0FF", 48, "center", 25);

    const ops = ["CONTINUAR", "CONFIGURAÇÕES", "RESETAR PONTOS", "MENU PRINCIPAL"];
    for (let i = 0; i < ops.length; i++) {
        let cor = opcaoMenuPausa === i ? "#FF007F" : "#FFFFFF";
        let prefixo = opcaoMenuPausa === i ? "> " : "  ";
        desenharTextoGlow(prefixo + ops[i], LARGURA / 2, 270 + (i * 50), cor, 22);
    }
}

function desenharFimDeJogo() {
    desenharTextoGlow("FIM DE JOGO", LARGURA / 2, 200, "#FF007F", 52, "center", 30);

    let vencedor = "";
    if (modoOnline) {
        vencedor = (pontosJ1 >= pontosParaVencer) ? "JOGADOR 1 VENCEU!" : "JOGADOR 2 VENCEU!";
    } else {
        vencedor = (pontosJ1 >= pontosParaVencer) ? "JOGADOR 1 VENCEU!" : (modoBot ? "O BOT VENCEU!" : "JOGADOR 2 VENCEU!");
    }

    desenharTextoGlow(vencedor, LARGURA / 2, 300, "#00F0FF", 28);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "14px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("PRESSIONE ESPAÇO, ESC OU CLIQUE PARA VOLTAR", LARGURA / 2, 420);
}

function aplicarDificuldade() {
    switch (dificuldadeAtual) {
        case Dificuldade.FACIL: velocidadeBolaBase = 6.0; velocidadeBot = 5; suavizacaoBot = 0.05; break;
        case Dificuldade.MEDIO: velocidadeBolaBase = 8.5; velocidadeBot = 8; suavizacaoBot = 0.09; break;
        case Dificuldade.DIFICIL: velocidadeBolaBase = 12.0; velocidadeBot = 12; suavizacaoBot = 0.15; break;
        case Dificuldade.FRENESI: velocidadeBolaBase = 6.0; velocidadeBot = 15; suavizacaoBot = 0.22; break;
    }
    velocidadeBolaAtual = velocidadeBolaBase;
}

function atualizar() {
    if (estadoAtual !== EstadoJogo.JOGANDO) return;

    if (modoOnline) {
        let posicaoAtualY = meuNumeroJogador === 1 ? j1Y : j2Y;
        let proximaY = posicaoAtualY;

        if (mouseAtivo && jogadorMouse === meuNumeroJogador) {
            proximaY = mousePos.y - (alturaRaquete / 2.0);
        } else {
            let pressionouSubir = meuNumeroJogador === 1 ? j1Cima : j2Cima;
            let pressionouDescer = meuNumeroJogador === 1 ? j1Baixo : j2Baixo;

            if (pressionouSubir) proximaY -= velocidadeRaquete;
            if (pressionouDescer) proximaY += velocidadeRaquete;
        }

        if (proximaY < 0) proximaY = 0;
        if (proximaY > ALTURA - alturaRaquete) proximaY = ALTURA - alturaRaquete;

        if (proximaY !== posicaoAtualY) {
            if (meuNumeroJogador === 1) j1Y = proximaY;
            else j2Y = proximaY;

            if (socket) socket.emit('movePaddle', proximaY);
        }

        if (meuNumeroJogador !== 1) return;
    } else {
        if (mouseAtivo && jogadorMouse === 1) {
            j1Y = mousePos.y - (alturaRaquete / 2.0);
        } else {
            if (j1Cima) j1Y -= velocidadeRaquete;
            if (j1Baixo) j1Y += velocidadeRaquete;
        }

        if (j1Y < 0) j1Y = 0;
        if (j1Y > ALTURA - alturaRaquete) j1Y = ALTURA - alturaRaquete;

        if (!modoTreino) {
            if (modoBot) {
                let alvoY = ALTURA / 2 - alturaRaquete / 2;
                if (bolaXDir > 0) alvoY = (bolaY + tamanhoBola / 2) - (alturaRaquete / 2);
                let passo = (alvoY - j2Y) * suavizacaoBot;
                if (Math.abs(passo) > velocidadeBot) passo = Math.sign(passo) * velocidadeBot;
                j2Y += passo;
            } else {
                if (mouseAtivo && jogadorMouse === 2) {
                    j2Y = mousePos.y - (alturaRaquete / 2.0);
                } else {
                    if (j2Cima) j2Y -= velocidadeRaquete;
                    if (j2Baixo) j2Y += velocidadeRaquete;
                }
            }

            if (j2Y < 0) j2Y = 0;
            if (j2Y > ALTURA - alturaRaquete) j2Y = ALTURA - alturaRaquete;
        }
    }

    if (!bolaEsperandoInicio) {
        bolaX += bolaXDir;
        bolaY += bolaYDir;

        rastroBola.push({ x: bolaX + tamanhoBola / 2, y: bolaY + tamanhoBola / 2 });
        if (rastroBola.length > 8) rastroBola.shift();

        if (bolaY <= 0 || bolaY >= ALTURA - tamanhoBola) {
            bolaYDir = -bolaYDir;
            sounds.hitWall();
            addScreenShake(3);
            criarParticulas(bolaX + tamanhoBola / 2, bolaY <= 0 ? 0 : ALTURA, corBola, 10);
        }

        if (bolaX <= 30 + LARGURA_RAQUETE && bolaX >= 30) {
            if (bolaY + tamanhoBola >= j1Y && bolaY <= j1Y + alturaRaquete) {
                let impactoRelativo = (bolaY + tamanhoBola / 2) - (j1Y + alturaRaquete / 2);
                let anguloSaida = (impactoRelativo / (alturaRaquete / 2)) * (Math.PI / 3);

                velocidadeBolaAtual += 0.3;
                bolaXDir = velocidadeBolaAtual * Math.cos(anguloSaida);
                bolaYDir = velocidadeBolaAtual * Math.sin(anguloSaida);
                bolaX = 30 + LARGURA_RAQUETE + 1;

                sounds.hitPaddle();
                addScreenShake(5);
                criarParticulas(bolaX, bolaY + tamanhoBola / 2, corJ1, 20);

                if (modoTreino) {
                    rebatesTreinoAtual++;
                    if (rebatesTreinoAtual > recordeTreino) recordeTreino = rebatesTreinoAtual;
                }
            }
        }

        if (!modoTreino) {
            if (bolaX + tamanhoBola >= LARGURA - 30 - LARGURA_RAQUETE && bolaX + tamanhoBola <= LARGURA - 30) {
                if (bolaY + tamanhoBola >= j2Y && bolaY <= j2Y + alturaRaquete) {
                    let impactoRelativo = (bolaY + tamanhoBola / 2) - (j2Y + alturaRaquete / 2);
                    let anguloSaida = (impactoRelativo / (alturaRaquete / 2)) * (Math.PI / 3);

                    velocidadeBolaAtual += 0.3;
                    bolaXDir = -velocidadeBolaAtual * Math.cos(anguloSaida);
                    bolaYDir = velocidadeBolaAtual * Math.sin(anguloSaida);
                    bolaX = LARGURA - 30 - LARGURA_RAQUETE - tamanhoBola - 1;

                    sounds.hitPaddle();
                    addScreenShake(5);
                    criarParticulas(bolaX + tamanhoBola, bolaY + tamanhoBola / 2, corJ2, 20);
                }
            }
        } else {
            if (bolaX + tamanhoBola >= LARGURA - 10) {
                bolaXDir = -Math.abs(bolaXDir);
                bolaX = LARGURA - 10 - tamanhoBola - 1;
                sounds.hitWall();
                addScreenShake(4);
            }
        }

        if (bolaX < 0) {
            sounds.score();
            addScreenShake(12);
            if (modoTreino) rebatesTreinoAtual = 0;
            else { pontosJ2++; verificarVitoria(); }
            reiniciarBola();
        } else if (bolaX > LARGURA && !modoTreino) {
            sounds.score();
            addScreenShake(12);
            pontosJ1++;
            verificarVitoria();
            reiniciarBola();
        }
    }

    if (modoOnline && meuNumeroJogador === 1 && socket) {
        socket.emit('updateGameState', {
            bola: { x: bolaX, y: bolaY, vx: bolaXDir, vy: bolaYDir },
            pontosJ1: pontosJ1,
            pontosJ2: pontosJ2,
            bolaEsperandoInicio: bolaEsperandoInicio
        });
    }
}

function verificarVitoria() {
    if (tipoJogoAtual === TipoJogo.PONTOS_DEFINIDOS) {
        if (pontosJ1 >= pontosParaVencer || pontosJ2 >= pontosParaVencer) {
            estadoAtual = EstadoJogo.FIM_DE_JOGO;
            temPartidaSalva = false;
        }
    }
}

function reiniciarBola() {
    bolaX = LARGURA / 2.0 - tamanhoBola / 2.0;
    bolaY = ALTURA / 2.0 - tamanhoBola / 2.0;
    velocidadeBolaAtual = velocidadeBolaBase;
    rastroBola = [];

    let paraDireita = Math.random() < 0.5;
    let variacao = (Math.random() * Math.PI / 2.0) - (Math.PI / 4.0);
    let angulo = paraDireita ? variacao : Math.PI + variacao;

    bolaXDir = velocidadeBolaAtual * Math.cos(angulo);
    bolaYDir = velocidadeBolaAtual * Math.sin(angulo);

    if (!modoBot) bolaEsperandoInicio = true;
}

function resetarPartida(zerarPontos) {
    if (zerarPontos) {
        pontosJ1 = 0;
        pontosJ2 = 0;
        rebatesTreinoAtual = 0;
    }
    j1Y = (ALTURA - alturaRaquete) / 2.0;
    j2Y = (ALTURA - alturaRaquete) / 2.0;
    aplicarDificuldade();
    reiniciarBola();
    if (modoBot) bolaEsperandoInicio = false;
    temPartidaSalva = true;
}

function alterarOpcaoOpcoes(direcao) {
    sounds.menuSelect();
    switch (opcaoMenuOpcoes) {
        case 0: dificuldadeAtual = (dificuldadeAtual + direcao + 4) % 4; aplicarDificuldade(); break;
        case 1: mouseAtivo = !mouseAtivo; break;
        case 2: jogadorMouse = jogadorMouse === 1 ? 2 : 1; break;
        case 3: idxCorJ1 = (idxCorJ1 + direcao + CORES_DISPONIVEIS.length) % CORES_DISPONIVEIS.length; corJ1 = CORES_DISPONIVEIS[idxCorJ1]; break;
        case 4: idxCorJ2 = (idxCorJ2 + direcao + CORES_DISPONIVEIS.length) % CORES_DISPONIVEIS.length; corJ2 = CORES_DISPONIVEIS[idxCorJ2]; break;
        case 5: idxCorBola = (idxCorBola + direcao + CORES_DISPONIVEIS.length) % CORES_DISPONIVEIS.length; corBola = CORES_DISPONIVEIS[idxCorBola]; break;
        case 6: idxTamRaquete = (idxTamRaquete + direcao + OPCOES_TAM_RAQUETE.length) % OPCOES_TAM_RAQUETE.length; alturaRaquete = OPCOES_TAM_RAQUETE[idxTamRaquete]; break;
        case 7: idxTamBola = (idxTamBola + direcao + OPCOES_TAM_BOLA.length) % OPCOES_TAM_BOLA.length; tamanhoBola = OPCOES_TAM_BOLA[idxTamBola]; break;
        case 8: idxVelRaquete = (idxVelRaquete + direcao + OPCOES_VEL_RAQUETE.length) % OPCOES_VEL_RAQUETE.length; velocidadeRaquete = OPCOES_VEL_RAQUETE[idxVelRaquete]; break;
        case 13: estadoAtual = estadoAnteriorOpcoes; break;
    }
}

// Mouse nos menus: mover sobre uma opção seleciona e clicar confirma.
const MENU_CONFIG={
 [EstadoJogo.MENU_MODO]:{startY:170,step:42,count:7},
 [EstadoJogo.MENU_TIPO_JOGO]:{startY:270,step:60,count:2},
 [EstadoJogo.MENU_META_PONTOS]:{startY:220,step:48,count:OPCOES_PONTOS.length},
 [EstadoJogo.MENU_OPCOES]:{startY:85,step:28,count:14},
 [EstadoJogo.PAUSADO]:{startY:270,step:50,count:4}
};
function menuIndexFromY(y){ const c=MENU_CONFIG[estadoAtual]; if(!c)return -1; const i=Math.floor((y-(c.startY-30))/c.step); return i>=0&&i<c.count?i:-1; }
canvas.addEventListener('mousemove',e=>{
 const r=canvas.getBoundingClientRect(), sx=LARGURA/r.width, sy=ALTURA/r.height;
 mousePos.x=(e.clientX-r.left)*sx; mousePos.y=(e.clientY-r.top)*sy;
 const i=menuIndexFromY(mousePos.y);
 if(i<0)return;
 if(estadoAtual===EstadoJogo.MENU_MODO)opcaoMenuModo=i;
 else if(estadoAtual===EstadoJogo.MENU_TIPO_JOGO)opcaoMenuTipoJogo=i;
 else if(estadoAtual===EstadoJogo.MENU_META_PONTOS)indiceOpcaoPontos=i;
 else if(estadoAtual===EstadoJogo.MENU_OPCOES)opcaoMenuOpcoes=i;
 else if(estadoAtual===EstadoJogo.PAUSADO)opcaoMenuPausa=i;
});
canvas.addEventListener('click',e=>{
 sounds.init();
 if(estadoAtual===EstadoJogo.JOGANDO){ if(bolaEsperandoInicio)bolaEsperandoInicio=false; return; }
 if(estadoAtual===EstadoJogo.FIM_DE_JOGO){modoOnline=false;estadoAtual=EstadoJogo.MENU_MODO;return;}
 const r=canvas.getBoundingClientRect(), y=(e.clientY-r.top)*(ALTURA/r.height), i=menuIndexFromY(y); if(i<0)return;
 if(estadoAtual===EstadoJogo.MENU_MODO){opcaoMenuModo=i;confirmarMenuModo();}
 else if(estadoAtual===EstadoJogo.MENU_TIPO_JOGO){opcaoMenuTipoJogo=i;confirmarMenuTipoJogo();}
 else if(estadoAtual===EstadoJogo.MENU_META_PONTOS){indiceOpcaoPontos=i;confirmarMenuMetaPontos();}
 else if(estadoAtual===EstadoJogo.MENU_OPCOES){opcaoMenuOpcoes=i;if(i===13)alterarOpcaoOpcoes(1);else alterarOpcaoOpcoes(1);}
 else if(estadoAtual===EstadoJogo.PAUSADO){opcaoMenuPausa=i;confirmarMenuPausa();}
});

// Navegação do Teclado
window.addEventListener('keydown', (e) => {
    sounds.init();

    if (estadoAtual === EstadoJogo.MENU_MODO) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { opcaoMenuModo = (opcaoMenuModo - 1 + 7) % 7; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { opcaoMenuModo = (opcaoMenuModo + 1) % 7; sounds.menuSelect(); }
        else if (e.code === "Space" || e.code === "Enter") confirmarMenuModo();
    } else if (estadoAtual === EstadoJogo.MENU_TIPO_JOGO) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { opcaoMenuTipoJogo = (opcaoMenuTipoJogo - 1 + 2) % 2; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { opcaoMenuTipoJogo = (opcaoMenuTipoJogo + 1) % 2; sounds.menuSelect(); }
        else if (e.code === "Space" || e.code === "Enter") confirmarMenuTipoJogo();
        else if (e.code === "Escape") estadoAtual = EstadoJogo.MENU_MODO;
    } else if (estadoAtual === EstadoJogo.MENU_META_PONTOS) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { indiceOpcaoPontos = (indiceOpcaoPontos - 1 + OPCOES_PONTOS.length) % OPCOES_PONTOS.length; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { indiceOpcaoPontos = (indiceOpcaoPontos + 1) % OPCOES_PONTOS.length; sounds.menuSelect(); }
        else if (e.code === "Space" || e.code === "Enter") confirmarMenuMetaPontos();
        else if (e.code === "Escape") estadoAtual = EstadoJogo.MENU_TIPO_JOGO;
    } else if (estadoAtual === EstadoJogo.MENU_OPCOES) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { opcaoMenuOpcoes = (opcaoMenuOpcoes - 1 + 14) % 14; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { opcaoMenuOpcoes = (opcaoMenuOpcoes + 1) % 14; sounds.menuSelect(); }
        else if (e.code === "KeyD" || e.code === "ArrowRight") alterarOpcaoOpcoes(1);
        else if (e.code === "KeyA" || e.code === "ArrowLeft") alterarOpcaoOpcoes(-1);
        else if (e.code === "Escape") estadoAtual = estadoAnteriorOpcoes;
    } else if (estadoAtual === EstadoJogo.JOGANDO) {
        if (e.code === "Escape") { estadoAtual = EstadoJogo.PAUSADO; return; }
        if (bolaEsperandoInicio) bolaEsperandoInicio = false;
        if (e.code === teclaJ1Cima) j1Cima = true;
        if (e.code === teclaJ1Baixo) j1Baixo = true;
        if (e.code === teclaJ2Cima) j2Cima = true;
        if (e.code === teclaJ2Baixo) j2Baixo = true;
    } else if (estadoAtual === EstadoJogo.PAUSADO) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { opcaoMenuPausa = (opcaoMenuPausa - 1 + 4) % 4; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { opcaoMenuPausa = (opcaoMenuPausa + 1) % 4; sounds.menuSelect(); }
        else if (e.code === "Space" || e.code === "Enter") confirmarMenuPausa();
        else if (e.code === "Escape") estadoAtual = EstadoJogo.JOGANDO;
    } else if (estadoAtual === EstadoJogo.FIM_DE_JOGO) {
        if (e.code === "Space" || e.code === "Enter" || e.code === "Escape") {
            modoOnline = false;
            estadoAtual = EstadoJogo.MENU_MODO;
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === teclaJ1Cima) j1Cima = false;
    if (e.code === teclaJ1Baixo) j1Baixo = false;
    if (e.code === teclaJ2Cima) j2Cima = false;
    if (e.code === teclaJ2Baixo) j2Baixo = false;
});

// Ações de Confirmação dos Menus
function confirmarMenuModo() {
    sounds.menuSelect();
    switch (opcaoMenuModo) {
        case 0:
            if (temPartidaSalva) {
                estadoAtual = EstadoJogo.JOGANDO;
            }
            break;
        case 1:
            modoBot = true;
            modoTreino = false;
            modoOnline = false;
            estadoAtual = EstadoJogo.MENU_TIPO_JOGO;
            break;
        case 2:
            modoBot = false;
            modoTreino = false;
            modoOnline = false;
            estadoAtual = EstadoJogo.MENU_TIPO_JOGO;
            break;
        case 3:
            abrirCriarSala();
            break;
        case 4:
            abrirLobbyOnline();
            break;
        case 5:
            modoBot = false;
            modoTreino = true;
            modoOnline = false;
            resetarPartida(true);
            estadoAtual = EstadoJogo.JOGANDO;
            break;
        case 6:
            estadoAnteriorOpcoes = EstadoJogo.MENU_MODO;
            estadoAtual = EstadoJogo.MENU_OPCOES;
            break;
    }
}

function confirmarMenuTipoJogo() {
    sounds.menuSelect();
    if (opcaoMenuTipoJogo === 0) {
        tipoJogoAtual = TipoJogo.PONTOS_DEFINIDOS;
        estadoAtual = EstadoJogo.MENU_META_PONTOS;
    } else {
        tipoJogoAtual = TipoJogo.INFINITO;
        resetarPartida(true);
        estadoAtual = EstadoJogo.JOGANDO;
    }
}

function confirmarMenuMetaPontos() {
    sounds.menuSelect();
    pontosParaVencer = OPCOES_PONTOS[indiceOpcaoPontos];
    resetarPartida(true);
    estadoAtual = EstadoJogo.JOGANDO;
}

function confirmarMenuPausa() {
    sounds.menuSelect();
    switch (opcaoMenuPausa) {
        case 0:
            estadoAtual = EstadoJogo.JOGANDO;
            break;
        case 1:
            estadoAnteriorOpcoes = EstadoJogo.PAUSADO;
            estadoAtual = EstadoJogo.MENU_OPCOES;
            break;
        case 2:
            resetarPartida(true);
            estadoAtual = EstadoJogo.JOGANDO;
            break;
        case 3:
            estadoAtual = EstadoJogo.MENU_MODO;
            break;
    }
}

resetarPartida(true);
requestAnimationFrame(gameLoop);