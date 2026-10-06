# Pong Neon Arena — GitHub Pages + Render

Esta versão separa o projeto em duas partes:

- **GitHub Pages:** hospeda `index.html`, `style.css`, `game.js` e `config.js`.
- **Render:** executa `server.js` e mantém as salas/multiplayer com Socket.IO.

## 1. Publicar o servidor no Render

Envie estes arquivos para um repositório GitHub:

`server.js`, `package.json`, `render.yaml` (e os demais arquivos do projeto).

No Render, crie um Web Service conectado ao repositório. O `render.yaml` usa:

- Build: `npm install`
- Start: `npm start`
- Node 18+

O servidor deve ficar em um endereço semelhante a:

`https://pong-neon-arena.onrender.com`

Se o Render gerar outro endereço, abra `config.js` e altere `window.PONG_SERVER_URL`.

## 2. Publicar o site no GitHub Pages

Na pasta do site, publique:

- `index.html`
- `style.css`
- `game.js`
- `config.js`

O `index.html` já carrega Socket.IO pelo CDN e o `game.js` conecta ao servidor definido em `config.js`.

## 3. Link do jogo

Depois de publicado, o endereço será:

`https://davivitor-hub.github.io/PONG3/`

## 4. Link para entrar diretamente em uma sala

Quando uma sala for criada, o jogo gera um link neste formato:

`https://davivitor-hub.github.io/PONG3/?sala=CODIGO`

Esse formato foi escolhido porque o GitHub Pages não executa a rota dinâmica `/join/CODIGO`. Ao abrir `?sala=CODIGO`, o navegador conecta ao servidor multiplayer e entra na sala automaticamente.

## 5. Importante

O GitHub Pages sozinho não executa Node.js/Socket.IO. Por isso o servidor Render é obrigatório para o multiplayer pela internet.

O endereço `localhost` não é usado pelo cliente publicado.
