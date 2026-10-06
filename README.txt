PONG DAS 7 SOMBRAS — ANTI-LAG ONLINE v2

Servidor multiplayer: https://pong3.onrender.com
WebSocket: wss://pong3.onrender.com

ESTRUTURA
- index.html: menu, jogo, skins e cliente online
- server.js: servidor HTTP + WebSocket e salas 1v1
- package.json: dependência ws e comando de inicialização
- render.yaml: configuração para Render

ONLINE
1. Publique esta pasta como Web Service no Render.
2. Build: npm install
3. Start: npm start
4. Abra https://pong3.onrender.com em dois navegadores/dispositivos.
5. Clique em MULTIPLAYER ONLINE nos dois. O servidor pareia os jogadores automaticamente.

CONTROLES
P1: W/S ou setas
P2 online: I/K
P: pausa local
ESC: voltar ao menu

O cliente usa WebSocket e o servidor mantém o estado da partida para sincronizar os dois jogadores.


Tela cheia: removida. O jogo permanece dentro da janela do navegador.

Conexão online: o cliente usa wss://pong3.onrender.com e faz reconexão automática com backoff quando a conexão cai. Isso melhora muito a disponibilidade, mas nenhuma aplicação web pode garantir 100% de conexão quando há falha de internet, indisponibilidade do Render ou bloqueio de rede.
