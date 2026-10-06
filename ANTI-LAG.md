# PONG3 Anti-Lag

Esta versão melhora a sensação de latência no multiplayer:
- raquete local responde imediatamente;
- envio de movimento usa pacotes voláteis e é limitado a ~30 Hz;
- raquete adversária é suavizada no cliente;
- bola é extrapolada entre atualizações do servidor;
- servidor continua autoritativo e atualiza o estado a 60 Hz;
- Socket.IO prioriza WebSocket e mantém reconexão automática.

## Deploy
1. Substitua os arquivos do seu repositório pelo conteúdo desta pasta.
2. Confirme `config.js` com `https://pong3.onrender.com`.
3. Faça commit/push no GitHub.
4. No Render, faça **Manual Deploy → Deploy latest commit**.
5. Jogue em `https://davivitor-hub.github.io/PONG3/`.

Observação: o anti-lag reduz o atraso percebido, mas não pode eliminar o ping real entre o computador do jogador e o servidor.
