# Pong Neon Arena 2.1 — Internet

Esta versão foi preparada para hospedagem pública. O navegador **não possui localhost fixo**: o Socket.IO se conecta automaticamente ao mesmo domínio que entregou o jogo.

## Opção 1 — Render

1. Crie um repositório no GitHub e envie todos os arquivos desta pasta.
2. No Render, crie um **Web Service** conectado ao repositório.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Node 18+ é recomendado (o projeto declara Node >=18).
6. Publique o serviço.

O arquivo `render.yaml` já contém a configuração básica para o Render.

Depois de publicado, o endereço será parecido com:

`https://seu-jogo.onrender.com`

Abra esse endereço e compartilhe com o outro jogador. As salas e o multiplayer usam o servidor automaticamente.

## Link direto para uma sala

Depois de criar uma sala, o botão de copiar link gera:

`https://seu-dominio.com/join/CODIGO`

Esse link abre o jogo e entra diretamente na sala.

## Opção 2 — Docker

```bash
docker build -t pong-neon-arena .
docker run -p 3000:3000 pong-neon-arena
```

Em uma VPS, coloque um domínio/reverse proxy na porta 3000 e habilite WebSocket.

## HTTPS

Em hospedagens como Render, o HTTPS é fornecido pela plataforma. O cliente usa o mesmo domínio, portanto o Socket.IO passa a usar `wss://` automaticamente quando a página estiver em HTTPS.

## Teste local

```bash
npm install
npm start
```

Depois: `http://localhost:3000`

O localhost serve apenas para teste local; ele não é necessário no código do cliente para publicar o jogo na internet.
