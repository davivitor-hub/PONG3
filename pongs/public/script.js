const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');

const socket = typeof io !== 'undefined' ? io() : null;

const LARGURA = 800;
const ALTURA = 600;

// Sistema de Som usando Web Audio API
class SoundFX {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

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
    MENU_ONLINE: 7,
    CRIAR_SALA: 8,
    ENTRAR_SALA: 9,
    AGUARDANDO_JOGADOR: 10
};

let estadoAtual = EstadoJogo.MENU_MODO;
let estadoAnteriorOpcoes = EstadoJogo.MENU_MODO;

let modoBot = false;
let modoTreino = false;
let modoOnline = false;
let meuNumeroJogador = 1; // 1 ou 2 no modo online
let codigoSalaOnline = "";
let codigoDigitadoSala = "";
let mensagemErroOnline = "";
let temPartidaSalva = false;

const TipoJogo = { PONTOS_DEFINIDOS: 0, INFINITO: 1 };
let tipoJogoAtual = TipoJogo.PONTOS_DEFINIDOS;

const Dificuldade = { FACIL: 0, MEDIO: 1, DIFICIL: 2, FRENESI: 3 };
let dificuldadeAtual = Dificuldade.MEDIO;
const NOMES_DIFICULDADE = ["Fácil", "Médio", "Difícil", "Frenesi"];

const OPCOES_PONTOS = [3, 5, 10, 15, 20];
let indiceOpcaoPontos = 1;
let pontosParaVencer = 5;

let opcaoMenuModo = 0;
let opcaoMenuTipoJogo = 0;
let opcaoMenuOpcoes = 0;
let opcaoMenuPausa = 0;
let opcaoMenuOnline = 0;

let teclaJ1Cima = "KeyW";
let teclaJ1Baixo = "KeyS";
let teclaJ2Cima = "ArrowUp";
let teclaJ2Baixo = "ArrowDown";
let aguardandoReinstalaTecla = false;
let acaoMapeando = "";

let mouseAtivo = true;
let jogadorMouse = 1;

const CORES_DISPONIVEIS = [
    "#00F0FF", "#FF007F", "#39FF14", "#FFE600",
    "#FF5E00", "#BF00FF", "#FFFFFF", "#00FFAB"
];
const NOMES_CORES = ["Ciano Neon", "Rosa Neon", "Verde Neon", "Amarelo Neon", "Laranja", "Roxo", "Branco", "Menta"];

let idxCorJ1 = 0, idxCorJ2 = 1, idxCorBola = 6;
let corJ1 = CORES_DISPONIVEIS[0], corJ2 = CORES_DISPONIVEIS[1], corBola = CORES_DISPONIVEIS[6];

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

let velocidadeBolaAtual = 7.0;
let velocidadeBolaBase = 7.0;
let velocidadeBot = 7;
let suavizacaoBot = 0.08;
let bolaEsperandoInicio = false;

let j1Y = 250, j2Y = 250;
let bolaX = 400, bolaY = 300;
let bolaXDir = 7, bolaYDir = 7;

let pontosJ1 = 0, pontosJ2 = 0;
let rebatesTreinoAtual = 0, recordeTreino = 0;

let j1Cima = false, j1Baixo = false, j2Cima = false, j2Baixo = false;
let mousePos = { x: 0, y: 0 };

let rastroBola = [];
let particulas = [];
let estrelasFundo = [];
let offsetGrade = 0;
let shakeIntensity = 0;

for (let i = 0; i < 40; i++) {
    estrelasFundo.push({
        x: Math.random() * LARGURA,
        y: Math.random() * ALTURA,
        size: Math.random() * 2,
        alpha: Math.random()
    });
}

// Configuração de Eventos do Socket.io
if (socket) {
    socket.on('roomCreated', (data) => {
        codigoSalaOnline = data.roomId;
        meuNumeroJogador = data.playerNum;
        estadoAtual = EstadoJogo.AGUARDANDO_JOGADOR;
    });

    socket.on('roomJoined', (data) => {
        codigoSalaOnline = data.roomId;
        meuNumeroJogador = data.playerNum;
    });

    socket.on('gameStart', (data) => {
        j1Y = data.j1Y;
        j2Y = data.j2Y;
        resetarPartida(true);
        estadoAtual = EstadoJogo.JOGANDO;
    });

    socket.on('roomError', (msg) => {
        mensagemErroOnline = msg;
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
        if (estadoAtual === EstadoJogo.JOGANDO || estadoAtual === EstadoJogo.AGUARDANDO_JOGADOR) {
            alert('O outro jogador se desconectou.');
            modoOnline = false;
            estadoAtual = EstadoJogo.MENU_MODO;
        }
    });
}

function addScreenShake(amount) {
    shakeIntensity = amount;
}

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
            x: x,
            y: y,
            vx: Math.cos(angulo) * vel,
            vy: Math.sin(angulo) * vel,
            cor: cor,
            vida: 1.0,
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
        case EstadoJogo.MENU_ONLINE: desenharMenuOnline(); break;
        case EstadoJogo.CRIAR_SALA: desenharCriarSala(); break;
        case EstadoJogo.ENTRAR_SALA: desenharEntrarSala(); break;
        case EstadoJogo.AGUARDANDO_JOGADOR: desenharAguardandoJogador(); break;
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
    desenharTextoGlow("PONG DAS 7 SOMBRAS", LARGURA / 2, 100, "#00F0FF", 42, "center", 25);

    const ops = [
        temPartidaSalva ? "CONTINUAR PARTIDA" : "[ SEM PARTIDA SALVA ]",
        "1 JOGADOR (VS BOT)",
        "2 JOGADORES (LOCAL)",
        "ONLINE MULTIPLAYER",
        "MODO TREINO (SOLO)",
        "OPÇÕES DO JOGO"
    ];

    for (let i = 0; i < ops.length; i++) {
        let cor = (i === 0 && !temPartidaSalva) ? "#444" : (opcaoMenuModo === i ? "#FF007F" : "#FFFFFF");
        let prefixo = opcaoMenuModo === i ? "> " : "  ";
        desenharTextoGlow(prefixo + ops[i], LARGURA / 2, 190 + (i * 45), cor, 20, "center", opcaoMenuModo === i ? 15 : 0);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "12px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("NAVEGUE COM O MOUSE OU W/S / SETAS | CLIQUE PARA CONFIRMAR", LARGURA / 2, 540);
}

function desenharMenuOnline() {
    desenharTextoGlow("MULTIPLAYER ONLINE", LARGURA / 2, 150, "#00F0FF", 36);

    const ops = ["CRIAR SALA", "ENTRAR COM CÓDIGO", "VOLTAR"];
    for (let i = 0; i < ops.length; i++) {
        let cor = opcaoMenuOnline === i ? "#FF007F" : "#FFFFFF";
        let prefixo = opcaoMenuOnline === i ? "> " : "  ";
        desenharTextoGlow(prefixo + ops[i], LARGURA / 2, 260 + (i * 60), cor, 22);
    }
}

function desenharCriarSala() {
    desenharTextoGlow("CRIAR SALA ONLINE", LARGURA / 2, 180, "#00F0FF", 36);
    desenharTextoGlow("PRESSIONE ENTER OU CLIQUE PARA GERAR CÓDIGO", LARGURA / 2, 300, "#FFFFFF", 16);
    desenharTextoGlow("[ ESC PARA VOLTAR ]", LARGURA / 2, 420, "#FFE600", 14);
}

function desenharAguardandoJogador() {
    desenharTextoGlow("SALA CRIADA COM SUCESSO!", LARGURA / 2, 160, "#39FF14", 32);
    desenharTextoGlow("CÓDIGO DA SALA:", LARGURA / 2, 240, "#FFFFFF", 20);
    desenharTextoGlow(codigoSalaOnline, LARGURA / 2, 310, "#FF007F", 52, "center", 30);
    desenharTextoGlow("AGUARDANDO JOGADOR 2 CONECTAR...", LARGURA / 2, 400, "#00F0FF", 18);
}

function desenharEntrarSala() {
    desenharTextoGlow("ENTRAR EM SALA ONLINE", LARGURA / 2, 160, "#00F0FF", 36);
    desenharTextoGlow("DIGITE O CÓDIGO DA SALA (6 DÍGITOS):", LARGURA / 2, 240, "#FFFFFF", 18);
    
    let textoCodigo = codigoDigitadoSala + "_";
    desenharTextoGlow(textoCodigo, LARGURA / 2, 320, "#FFE600", 44, "center", 20);

    if (mensagemErroOnline) {
        desenharTextoGlow(mensagemErroOnline, LARGURA / 2, 390, "#FF007F", 18);
    }

    desenharTextoGlow("PRESSIONE ENTER PARA ENTRAR | ESC PARA VOLTAR", LARGURA / 2, 470, "#FFFFFF", 14);
}

function desenharMenuOpcoes() {
    desenharTextoGlow("CONFIGURAÇÕES", LARGURA / 2, 50, "#00F0FF", 32, "center", 20);

    const ops = [
        "Dificuldade: < " + NOMES_DIFICULDADE[dificuldadeAtual] + " >",
        "Ativar Mouse: < " + (mouseAtivo ? "Sim" : "Não") + " >",
        "Jogador com Mouse: < Jogador " + jogadorMouse + " >",
        "Cor Raquete J1: < " + NOMES_CORES[idxCorJ1] + " >",
        "Cor Raquete J2 / Parede: < " + NOMES_CORES[idxCorJ2] + " >",
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

    if (aguardandoReinstalaTecla) {
        ctx.fillStyle = "rgba(5, 5, 20, 0.95)";
        ctx.fillRect(150, 220, 500, 140);
        ctx.strokeStyle = "#FF007F";
        ctx.lineWidth = 2;
        ctx.strokeRect(150, 220, 500, 140);
        desenharTextoGlow("PRESSIONE A NOVA TECLA PARA:", LARGURA / 2, 270, "#FFFFFF", 16);
        desenharTextoGlow(acaoMapeando, LARGURA / 2, 310, "#00F0FF", 20);
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
        case Dificuldade.FACIL:
            velocidadeBolaBase = 6.0;
            velocidadeBot = 5;
            suavizacaoBot = 0.05;
            break;
        case Dificuldade.MEDIO:
            velocidadeBolaBase = 8.5;
            velocidadeBot = 8;
            suavizacaoBot = 0.09;
            break;
        case Dificuldade.DIFICIL:
            velocidadeBolaBase = 12.0;
            velocidadeBot = 12;
            suavizacaoBot = 0.15;
            break;
        case Dificuldade.FRENESI:
            velocidadeBolaBase = 6.0;
            velocidadeBot = 15;
            suavizacaoBot = 0.22;
            break;
    }
    let velocidadeAntiga = velocidadeBolaAtual;
    velocidadeBolaAtual = velocidadeBolaBase;

    if (velocidadeAntiga !== 0) {
        let fator = velocidadeBolaAtual / velocidadeAntiga;
        bolaXDir *= fator;
        bolaYDir *= fator;
    }
}

function aumentarVelocidadeFrenesi() {
    if (dificuldadeAtual === Dificuldade.FRENESI && velocidadeBolaAtual < 22.0) {
        velocidadeBolaAtual += 0.8;
        let sinalX = bolaXDir > 0 ? 1 : -1;
        let sinalY = bolaYDir > 0 ? 1 : -1;
        bolaXDir = sinalX * velocidadeBolaAtual;
        bolaYDir = sinalY * velocidadeBolaAtual;
    }
}

function atualizar() {
    if (estadoAtual !== EstadoJogo.JOGANDO) return;

    if (modoOnline) {
        // Controle da Raquete Local no Modo Online
        let posicaoAtualY = meuNumeroJogador === 1 ? j1Y : j2Y;
        let proximaY = posicaoAtualY;

        if (mouseAtivo && jogadorMouse === meuNumeroJogador) {
            proximaY = mousePos.y - (alturaRaquete / 2.0);
        } else {
            let teclaSubir = meuNumeroJogador === 1 ? teclaJ1Cima : teclaJ2Cima;
            let teclaDescer = meuNumeroJogador === 1 ? teclaJ1Baixo : teclaJ2Baixo;
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

        // Apenas o Jogador 1 (Host) executa a simulação física da bola e envia para o Jogador 2
        if (meuNumeroJogador !== 1) return;
    } else {
        // Controles Offline (Singleplayer / Local)
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

                let deltaY = alvoY - j2Y;
                let passo = deltaY * suavizacaoBot;

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

    // Física e Movimentação da Bola
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

        // Colisão Raquete J1
        if (bolaX <= 30 + LARGURA_RAQUETE && bolaX >= 30) {
            if (bolaY + tamanhoBola >= j1Y && bolaY <= j1Y + alturaRaquete) {
                let impactoRelativo = (bolaY + tamanhoBola / 2) - (j1Y + alturaRaquete / 2);
                let anguloNormalizado = impactoRelativo / (alturaRaquete / 2);
                let anguloSaida = anguloNormalizado * (Math.PI / 3);

                velocidadeBolaAtual += 0.3;
                bolaXDir = velocidadeBolaAtual * Math.cos(anguloSaida);
                bolaYDir = velocidadeBolaAtual * Math.sin(anguloSaida);

                bolaX = 30 + LARGURA_RAQUETE + 1;
                sounds.hitPaddle();
                addScreenShake(5);
                criarParticulas(bolaX, bolaY + tamanhoBola / 2, corJ1, 20);
                aumentarVelocidadeFrenesi();

                if (modoTreino) {
                    rebatesTreinoAtual++;
                    if (rebatesTreinoAtual > recordeTreino) recordeTreino = rebatesTreinoAtual;
                }
            }
        }

        if (modoTreino) {
            if (bolaX + tamanhoBola >= LARGURA - 10) {
                bolaXDir = -Math.abs(bolaXDir);
                bolaX = LARGURA - 10 - tamanhoBola - 1;
                sounds.hitWall();
                addScreenShake(4);
                criarParticulas(LARGURA - 10, bolaY + tamanhoBola / 2, corJ2, 20);
                aumentarVelocidadeFrenesi();
            }
        } else {
            // Colisão Raquete J2
            if (bolaX + tamanhoBola >= LARGURA - 30 - LARGURA_RAQUETE && bolaX + tamanhoBola <= LARGURA - 30) {
                if (bolaY + tamanhoBola >= j2Y && bolaY <= j2Y + alturaRaquete) {
                    let impactoRelativo = (bolaY + tamanhoBola / 2) - (j2Y + alturaRaquete / 2);
                    let anguloNormalizado = impactoRelativo / (alturaRaquete / 2);
                    let anguloSaida = anguloNormalizado * (Math.PI / 3);

                    velocidadeBolaAtual += 0.3;
                    bolaXDir = -velocidadeBolaAtual * Math.cos(anguloSaida);
                    bolaYDir = velocidadeBolaAtual * Math.sin(anguloSaida);

                    bolaX = LARGURA - 30 - LARGURA_RAQUETE - tamanhoBola - 1;
                    sounds.hitPaddle();
                    addScreenShake(5);
                    criarParticulas(bolaX + tamanhoBola, bolaY + tamanhoBola / 2, corJ2, 20);
                    aumentarVelocidadeFrenesi();
                }
            }
        }

        if (bolaX < 0) {
            sounds.score();
            addScreenShake(12);
            if (modoTreino) {
                rebatesTreinoAtual = 0;
            } else {
                pontosJ2++;
                verificarVitoria();
            }
            reiniciarBola();
        } else if (bolaX > LARGURA && !modoTreino) {
            sounds.score();
            addScreenShake(12);
            pontosJ1++;
            verificarVitoria();
            reiniciarBola();
        }
    }

    // Sincronizar dados com o Jogador 2 se for Host Online
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

    let angulo;
    if (modoTreino) {
        angulo = (Math.random() * Math.PI / 2.0) - (Math.PI / 4.0);
    } else {
        let paraDireita = Math.random() < 0.5;
        let variacao = (Math.random() * Math.PI / 2.0) - (Math.PI / 4.0);
        angulo = paraDireita ? variacao : Math.PI + variacao;
    }

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
    j1Cima = j1Baixo = j2Cima = j2Baixo = false;

    aplicarDificuldade();
    reiniciarBola();

    if (modoBot) bolaEsperandoInicio = false;
    temPartidaSalva = true;
}

function alterarOpcaoOpcoes(direcao) {
    sounds.menuSelect();
    switch (opcaoMenuOpcoes) {
        case 0:
            dificuldadeAtual = (dificuldadeAtual + direcao + 4) % 4;
            aplicarDificuldade();
            break;
        case 1:
            mouseAtivo = !mouseAtivo;
            break;
        case 2:
            jogadorMouse = jogadorMouse === 1 ? 2 : 1;
            break;
        case 3:
            idxCorJ1 = (idxCorJ1 + direcao + CORES_DISPONIVEIS.length) % CORES_DISPONIVEIS.length;
            corJ1 = CORES_DISPONIVEIS[idxCorJ1];
            break;
        case 4:
            idxCorJ2 = (idxCorJ2 + direcao + CORES_DISPONIVEIS.length) % CORES_DISPONIVEIS.length;
            corJ2 = CORES_DISPONIVEIS[idxCorJ2];
            break;
        case 5:
            idxCorBola = (idxCorBola + direcao + CORES_DISPONIVEIS.length) % CORES_DISPONIVEIS.length;
            corBola = CORES_DISPONIVEIS[idxCorBola];
            break;
        case 6:
            idxTamRaquete = (idxTamRaquete + direcao + OPCOES_TAM_RAQUETE.length) % OPCOES_TAM_RAQUETE.length;
            alturaRaquete = OPCOES_TAM_RAQUETE[idxTamRaquete];
            break;
        case 7:
            idxTamBola = (idxTamBola + direcao + OPCOES_TAM_BOLA.length) % OPCOES_TAM_BOLA.length;
            tamanhoBola = OPCOES_TAM_BOLA[idxTamBola];
            break;
        case 8:
            idxVelRaquete = (idxVelRaquete + direcao + OPCOES_VEL_RAQUETE.length) % OPCOES_VEL_RAQUETE.length;
            velocidadeRaquete = OPCOES_VEL_RAQUETE[idxVelRaquete];
            break;
        case 9: aguardandoReinstalaTecla = true; acaoMapeando = "J1 Subir"; break;
        case 10: aguardandoReinstalaTecla = true; acaoMapeando = "J1 Descer"; break;
        case 11: aguardandoReinstalaTecla = true; acaoMapeando = "J2 Subir"; break;
        case 12: aguardandoReinstalaTecla = true; acaoMapeando = "J2 Descer"; break;
        case 13: estadoAtual = estadoAnteriorOpcoes; break;
    }
}

window.addEventListener('keydown', (e) => {
    sounds.init();

    if (aguardandoReinstalaTecla) {
        if (acaoMapeando === "J1 Subir") teclaJ1Cima = e.code;
        else if (acaoMapeando === "J1 Descer") teclaJ1Baixo = e.code;
        else if (acaoMapeando === "J2 Subir") teclaJ2Cima = e.code;
        else if (acaoMapeando === "J2 Descer") teclaJ2Baixo = e.code;

        aguardandoReinstalaTecla = false;
        return;
    }

    if (estadoAtual === EstadoJogo.ENTRAR_SALA) {
        if (e.key >= '0' && e.key <= '9' && codigoDigitadoSala.length < 6) {
            codigoDigitadoSala += e.key;
            sounds.menuSelect();
        } else if (e.key === 'Backspace') {
            codigoDigitadoSala = codigoDigitadoSala.slice(0, -1);
            sounds.menuSelect();
        } else if (e.key === 'Enter' && codigoDigitadoSala.length === 6) {
            if (socket) socket.emit('joinRoom', codigoDigitadoSala);
        } else if (e.key === 'Escape') {
            estadoAtual = EstadoJogo.MENU_ONLINE;
        }
        return;
    }

    if (estadoAtual === EstadoJogo.MENU_MODO) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { opcaoMenuModo = (opcaoMenuModo - 1 + 6) % 6; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { opcaoMenuModo = (opcaoMenuModo + 1) % 6; sounds.menuSelect(); }
        else if (e.code === "Space" || e.code === "Enter") confirmarMenuModo();
    } 
    else if (estadoAtual === EstadoJogo.MENU_ONLINE) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { opcaoMenuOnline = (opcaoMenuOnline - 1 + 3) % 3; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { opcaoMenuOnline = (opcaoMenuOnline + 1) % 3; sounds.menuSelect(); }
        else if (e.code === "Space" || e.code === "Enter") confirmarMenuOnline();
        else if (e.code === "Escape") estadoAtual = EstadoJogo.MENU_MODO;
    }
    else if (estadoAtual === EstadoJogo.CRIAR_SALA) {
        if (e.code === "Enter" || e.code === "Space") {
            if (socket) socket.emit('createRoom');
        } else if (e.code === "Escape") {
            estadoAtual = EstadoJogo.MENU_ONLINE;
        }
    }
    else if (estadoAtual === EstadoJogo.AGUARDANDO_JOGADOR) {
        if (e.code === "Escape") {
            modoOnline = false;
            estadoAtual = EstadoJogo.MENU_ONLINE;
        }
    }
    else if (estadoAtual === EstadoJogo.MENU_TIPO_JOGO) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { opcaoMenuTipoJogo = (opcaoMenuTipoJogo - 1 + 2) % 2; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { opcaoMenuTipoJogo = (opcaoMenuTipoJogo + 1) % 2; sounds.menuSelect(); }
        else if (e.code === "Space" || e.code === "Enter") confirmarMenuTipoJogo();
        else if (e.code === "Escape") estadoAtual = EstadoJogo.MENU_MODO;
    } 
    else if (estadoAtual === EstadoJogo.MENU_META_PONTOS) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { indiceOpcaoPontos = (indiceOpcaoPontos - 1 + OPCOES_PONTOS.length) % OPCOES_PONTOS.length; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { indiceOpcaoPontos = (indiceOpcaoPontos + 1) % OPCOES_PONTOS.length; sounds.menuSelect(); }
        else if (e.code === "Space" || e.code === "Enter") confirmarMenuMetaPontos();
        else if (e.code === "Escape") estadoAtual = EstadoJogo.MENU_TIPO_JOGO;
    } 
    else if (estadoAtual === EstadoJogo.MENU_OPCOES) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { opcaoMenuOpcoes = (opcaoMenuOpcoes - 1 + 14) % 14; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { opcaoMenuOpcoes = (opcaoMenuOpcoes + 1) % 14; sounds.menuSelect(); }
        else if (e.code === "KeyD" || e.code === "ArrowRight") alterarOpcaoOpcoes(1);
        else if (e.code === "KeyA" || e.code === "ArrowLeft") alterarOpcaoOpcoes(-1);
        else if (e.code === "Space" || e.code === "Enter") alterarOpcaoOpcoes(1);
        else if (e.code === "Escape") estadoAtual = estadoAnteriorOpcoes;
    } 
    else if (estadoAtual === EstadoJogo.JOGANDO) {
        if (e.code === "Escape") {
            opcaoMenuPausa = 0;
            estadoAtual = EstadoJogo.PAUSADO;
            return;
        }
        if (bolaEsperandoInicio) bolaEsperandoInicio = false;

        if (e.code === teclaJ1Cima) j1Cima = true;
        if (e.code === teclaJ1Baixo) j1Baixo = true;
        if (!modoBot && !modoTreino) {
            if (e.code === teclaJ2Cima) j2Cima = true;
            if (e.code === teclaJ2Baixo) j2Baixo = true;
        }
    } 
    else if (estadoAtual === EstadoJogo.PAUSADO) {
        if (e.code === "KeyW" || e.code === "ArrowUp") { opcaoMenuPausa = (opcaoMenuPausa - 1 + 4) % 4; sounds.menuSelect(); }
        else if (e.code === "KeyS" || e.code === "ArrowDown") { opcaoMenuPausa = (opcaoMenuPausa + 1) % 4; sounds.menuSelect(); }
        else if (e.code === "Space" || e.code === "Enter") confirmarMenuPausa();
        else if (e.code === "Escape") estadoAtual = EstadoJogo.JOGANDO;
    } 
    else if (estadoAtual === EstadoJogo.FIM_DE_JOGO) {
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

function confirmarMenuModo() {
    sounds.menuSelect();
    if (opcaoMenuModo === 0 && temPartidaSalva) {
        estadoAtual = EstadoJogo.JOGANDO;
    } else if (opcaoMenuModo === 3) {
        modoOnline = true;
        modoBot = false;
        modoTreino = false;
        estadoAtual = EstadoJogo.MENU_ONLINE;
    } else if (opcaoMenuModo === 5) {
        estadoAnteriorOpcoes = EstadoJogo.MENU_MODO;
        estadoAtual = EstadoJogo.MENU_OPCOES;
    } else if (opcaoMenuModo > 0) {
        modoOnline = false;
        modoBot = opcaoMenuModo === 1;
        modoTreino = opcaoMenuModo === 4;
        if (modoTreino) {
            resetarPartida(true);
            estadoAtual = EstadoJogo.JOGANDO;
        } else {
            estadoAtual = EstadoJogo.MENU_TIPO_JOGO;
        }
    }
}

function confirmarMenuOnline() {
    sounds.menuSelect();
    if (opcaoMenuOnline === 0) {
        estadoAtual = EstadoJogo.CRIAR_SALA;
    } else if (opcaoMenuOnline === 1) {
        codigoDigitadoSala = "";
        mensagemErroOnline = "";
        estadoAtual = EstadoJogo.ENTRAR_SALA;
    } else if (opcaoMenuOnline === 2) {
        modoOnline = false;
        estadoAtual = EstadoJogo.MENU_MODO;
    }
}

function confirmarMenuTipoJogo() {
    sounds.menuSelect();
    tipoJogoAtual = opcaoMenuTipoJogo === 0 ? TipoJogo.PONTOS_DEFINIDOS : TipoJogo.INFINITO;
    if (tipoJogoAtual === TipoJogo.PONTOS_DEFINIDOS) {
        estadoAtual = EstadoJogo.MENU_META_PONTOS;
    } else {
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
    if (opcaoMenuPausa === 0) estadoAtual = EstadoJogo.JOGANDO;
    else if (opcaoMenuPausa === 1) {
        estadoAnteriorOpcoes = EstadoJogo.PAUSADO;
        estadoAtual = EstadoJogo.MENU_OPCOES;
    } else if (opcaoMenuPausa === 2) {
        resetarPartida(true);
        estadoAtual = EstadoJogo.JOGANDO;
    } else if (opcaoMenuPausa === 3) {
        modoOnline = false;
        estadoAtual = EstadoJogo.MENU_MODO;
    }
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;

    let y = mousePos.y;

    if (estadoAtual === EstadoJogo.MENU_MODO) {
        for (let i = 0; i < 6; i++) {
            let itemY = 190 + (i * 45);
            if (y >= itemY - 20 && y <= itemY + 20) {
                opcaoMenuModo = i;
            }
        }
    } else if (estadoAtual === EstadoJogo.MENU_ONLINE) {
        for (let i = 0; i < 3; i++) {
            let itemY = 260 + (i * 60);
            if (y >= itemY - 20 && y <= itemY + 20) {
                opcaoMenuOnline = i;
            }
        }
    } else if (estadoAtual === EstadoJogo.MENU_TIPO_JOGO) {
        for (let i = 0; i < 2; i++) {
            let itemY = 270 + (i * 60);
            if (y >= itemY - 20 && y <= itemY + 20) {
                opcaoMenuTipoJogo = i;
            }
        }
    } else if (estadoAtual === EstadoJogo.MENU_META_PONTOS) {
        for (let i = 0; i < OPCOES_PONTOS.length; i++) {
            let itemY = 220 + (i * 48);
            if (y >= itemY - 20 && y <= itemY + 20) {
                indiceOpcaoPontos = i;
            }
        }
    } else if (estadoAtual === EstadoJogo.MENU_OPCOES) {
        for (let i = 0; i < 14; i++) {
            let itemY = 85 + (i * 28);
            if (y >= itemY - 14 && y <= itemY + 14) {
                opcaoMenuOpcoes = i;
            }
        }
    } else if (estadoAtual === EstadoJogo.PAUSADO) {
        for (let i = 0; i < 4; i++) {
            let itemY = 270 + (i * 50);
            if (y >= itemY - 20 && y <= itemY + 20) {
                opcaoMenuPausa = i;
            }
        }
    }
});

canvas.addEventListener('mousedown', (e) => {
    sounds.init();
    if (estadoAtual === EstadoJogo.JOGANDO) {
        if (bolaEsperandoInicio) bolaEsperandoInicio = false;
    } else if (estadoAtual === EstadoJogo.MENU_MODO) {
        confirmarMenuModo();
    } else if (estadoAtual === EstadoJogo.MENU_ONLINE) {
        confirmarMenuOnline();
    } else if (estadoAtual === EstadoJogo.CRIAR_SALA) {
        if (socket) socket.emit('createRoom');
    } else if (estadoAtual === EstadoJogo.MENU_TIPO_JOGO) {
        confirmarMenuTipoJogo();
    } else if (estadoAtual === EstadoJogo.MENU_META_PONTOS) {
        confirmarMenuMetaPontos();
    } else if (estadoAtual === EstadoJogo.MENU_OPCOES) {
        alterarOpcaoOpcoes(1);
    } else if (estadoAtual === EstadoJogo.PAUSADO) {
        confirmarMenuPausa();
    } else if (estadoAtual === EstadoJogo.FIM_DE_JOGO) {
        modoOnline = false;
        estadoAtual = EstadoJogo.MENU_MODO;
    }
});

// Suporte Touch
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mousePos.x = touch.clientX - rect.left;
    mousePos.y = touch.clientY - rect.top;
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    sounds.init();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mousePos.x = touch.clientX - rect.left;
    mousePos.y = touch.clientY - rect.top;

    if (estadoAtual === EstadoJogo.JOGANDO) {
        if (bolaEsperandoInicio) bolaEsperandoInicio = false;
    } else if (estadoAtual === EstadoJogo.MENU_MODO) {
        confirmarMenuModo();
    } else if (estadoAtual === EstadoJogo.MENU_ONLINE) {
        confirmarMenuOnline();
    } else if (estadoAtual === EstadoJogo.CRIAR_SALA) {
        if (socket) socket.emit('createRoom');
    } else if (estadoAtual === EstadoJogo.MENU_TIPO_JOGO) {
        confirmarMenuTipoJogo();
    } else if (estadoAtual === EstadoJogo.MENU_META_PONTOS) {
        confirmarMenuMetaPontos();
    } else if (estadoAtual === EstadoJogo.MENU_OPCOES) {
        alterarOpcaoOpcoes(1);
    } else if (estadoAtual === EstadoJogo.PAUSADO) {
        confirmarMenuPausa();
    } else if (estadoAtual === EstadoJogo.FIM_DE_JOGO) {
        modoOnline = false;
        estadoAtual = EstadoJogo.MENU_MODO;
    }
}, { passive: true });

gameLoop();