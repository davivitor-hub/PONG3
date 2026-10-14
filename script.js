(() => {
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io({transports:['websocket','polling']});
const $ = id => document.getElementById(id);
const W=800,H=600,PH=100;
let mode='menu', player=1, roomId=null, p1=250,p2=250,score1=0,score2=0;
let ball={x:400,y:300,vx:8,vy:2}, powerup=null, keys=new Set(), lastPaddleSend=0;
let particles=[], trail=[], screenShake=0, toastTimer;
const COLORS={cyan:'#00f0ff',pink:'#ff3b9d',white:'#f4fbff',muted:'#8091b8'};
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600)}
function setStatus(text,online=false){$('statusText').textContent=text;$('statusDot').parentElement.classList.toggle('online',online)}
function overlay(id){['menuOverlay','waitingOverlay','resultOverlay'].forEach(x=>$(x).classList.toggle('hidden',x!==id))}
function drawBackground(){
 ctx.fillStyle='#030610';ctx.fillRect(0,0,W,H);
 const grad=ctx.createRadialGradient(W/2,H/2,20,W/2,H/2,500);grad.addColorStop(0,'#101b31');grad.addColorStop(1,'#030610');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#15223a';ctx.lineWidth=1;
 for(let x=40;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
 for(let y=40;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 ctx.save();ctx.setLineDash([13,15]);ctx.strokeStyle='#3d5274';ctx.globalAlpha=.7;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(W/2,18);ctx.lineTo(W/2,H-18);ctx.stroke();ctx.restore();
}
function glowRect(x,y,w,h,color){ctx.save();ctx.shadowColor=color;ctx.shadowBlur=24;ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.restore();ctx.fillStyle='#ffffffaa';ctx.fillRect(x+2,y+8,2,Math.max(2,h-16))}
function spawnParticles(x,y,color,count=12){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=1+Math.random()*5;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:25+Math.random()*20,color})}}
function draw(){
 drawBackground();
 // score cards
 ctx.textAlign='center';ctx.font='800 46px Orbitron,Arial';ctx.fillStyle='#00f0ff';ctx.shadowColor='#00f0ff';ctx.shadowBlur=18;ctx.fillText(score1, W/2-80,72);
 ctx.fillStyle='#ff3b9d';ctx.shadowColor='#ff3b9d';ctx.fillText(score2,W/2+80,72);ctx.shadowBlur=0;
 ctx.font='10px Orbitron,Arial';ctx.fillStyle='#6f83a9';ctx.fillText('JOGADOR 1',W/2-80,91);ctx.fillText('JOGADOR 2',W/2+80,91);
 // trail
 trail.push({x:ball.x,y:ball.y});if(trail.length>12)trail.shift();
 trail.forEach((t,i)=>{ctx.globalAlpha=(i/trail.length)*.24;ctx.fillStyle='#00f0ff';ctx.beginPath();ctx.arc(t.x,t.y,2+i*.45,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;
 if(powerup){ctx.save();ctx.translate(powerup.x,powerup.y);ctx.rotate(Date.now()/500);ctx.shadowBlur=24;ctx.shadowColor=powerup.type==='boost'?'#ffe66d':'#b77aff';ctx.strokeStyle=powerup.type==='boost'?'#ffe66d':'#b77aff';ctx.lineWidth=3;ctx.strokeRect(-11,-11,22,22);ctx.restore()}
 glowRect(30,p1,12,PH,COLORS.cyan);glowRect(W-42,p2,12,PH,COLORS.pink);
 ctx.save();ctx.shadowColor='#fff';ctx.shadowBlur=26;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x,ball.y,9,0,Math.PI*2);ctx.fill();ctx.restore();
 particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vx*=.97;p.vy*=.97;p.life--;ctx.globalAlpha=Math.min(1,p.life/20);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3)});ctx.globalAlpha=1;
 if(mode==='playing' && !socket.connected){ctx.fillStyle='#ff3b9d';ctx.font='12px Orbitron';ctx.textAlign='center';ctx.fillText('RECONectando…',W/2,H-22)}
}
function loop(){draw();requestAnimationFrame(loop)} loop();
function startMatch(){mode='searching';roomId=null;overlay('waitingOverlay');$('waitStatus').textContent='Aguardando outro jogador clicar em MULTIPLAYER…';$('shareLink').value=location.origin+(location.pathname.includes('/join/')?location.pathname:'/');$('modePill').textContent='BUSCANDO OPONENTE';setStatus('PROCURANDO',true);socket.emit('match:find')}
$('multiplayerBtn').addEventListener('click',startMatch);
$('againBtn').addEventListener('click',()=>{overlay('waitingOverlay');startMatch()});
$('menuBtn').addEventListener('click',()=>{mode='menu';overlay('menuOverlay');$('modePill').textContent='PRONTO PARA JOGAR';setStatus('ONLINE',socket.connected)});
$('cancelBtn').addEventListener('click',()=>{socket.emit('match:leave');mode='menu';overlay('menuOverlay');$('modePill').textContent='PRONTO PARA JOGAR'});
$('copyBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('shareLink').value);toast('Link copiado! Envie para seu amigo.')}catch{ $('shareLink').select();document.execCommand('copy');toast('Link copiado!')}});
socket.on('connect',()=>{setStatus('ONLINE',true);const m=location.pathname.match(/\/join\/([^/]+)/);if(m){mode='joining';overlay('waitingOverlay');$('waitStatus').textContent='Entrando na partida compartilhada…';socket.emit('match:join-link',decodeURIComponent(m[1]))}});
socket.on('disconnect',()=>setStatus('RECONECTANDO'));
socket.on('match:waiting',data=>{roomId=data.roomId;player=1;mode='searching';const link=location.origin+'/join/'+data.roomId;$('shareLink').value=link;$('waitStatus').textContent='Aguardando outro jogador clicar em MULTIPLAYER…';$('modePill').textContent='AGUARDANDO OPONENTE';});
socket.on('match:role',d=>{player=d.player;roomId=d.roomId;$('playerLabel').textContent=player===1?'JOGADOR 1 • VOCÊ':'JOGADOR 2 • VOCÊ'});
socket.on('match:start',s=>{mode='playing';overlay('');score1=s.score1||0;score2=s.score2||0;p1=s.p1;p2=s.p2;ball=s.ball;powerup=s.powerup||null;$('modePill').textContent='PARTIDA AO VIVO';$('playerLabel').textContent=player===1?'JOGADOR 1 • VOCÊ':'JOGADOR 2 • VOCÊ';toast('Oponente conectado! Boa partida!')});
socket.on('state',s=>{if(mode!=='playing')return;p1=s.p1;p2=s.p2;score1=s.score1;score2=s.score2;ball=s.ball;powerup=s.powerup||null});
socket.on('match:error',msg=>{mode='menu';overlay('resultOverlay');$('resultTitle').textContent='Não foi possível entrar';$('resultText').textContent=msg;$('modePill').textContent='ERRO'});
socket.on('match:opponent-left',()=>{if(mode==='playing'||mode==='searching'){mode='menu';overlay('resultOverlay');$('resultTitle').textContent='Oponente desconectou';$('resultText').textContent='A partida terminou. Você pode encontrar outro adversário.';$('modePill').textContent='PARTIDA ENCERRADA';toast('O oponente saiu da partida.')}});
socket.on('fx:hit',d=>{spawnParticles(d.side===1?42:W-42, d.side===1?p1+PH/2:p2+PH/2,d.side===1?COLORS.cyan:COLORS.pink,9)});
socket.on('fx:point',d=>{screenShake=8;spawnParticles(d.winner===1?W-20:20,H/2,d.winner===1?COLORS.cyan:COLORS.pink,28);toast(d.winner===player?'PONTO SEU!':'Ponto do adversário')});
socket.on('fx:power',d=>{spawnParticles(W/2,H/2,d.type==='boost'?'#ffe66d':'#b77aff',24);toast(d.type==='boost'?'⚡ Bônus de velocidade!':'✦ Bola desacelerada!')});
function movePaddle(y){if(mode!=='playing')return;const now=performance.now();if(now-lastPaddleSend<12)return;lastPaddleSend=now;socket.emit('paddle:set',Math.max(0,Math.min(H-PH,y)))}
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();keys.add(e.code)});
window.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('mousemove',e=>{if(mode!=='playing')return;const r=canvas.getBoundingClientRect();const y=(e.clientY-r.top)*H/r.height;movePaddle(y-PH/2)});
canvas.addEventListener('touchmove',e=>{if(mode!=='playing')return;e.preventDefault();const r=canvas.getBoundingClientRect();movePaddle((e.touches[0].clientY-r.top)*H/r.height-PH/2)},{passive:false});
function controls(){if(mode==='playing'){const up=keys.has('KeyW')||keys.has('ArrowUp'),down=keys.has('KeyS')||keys.has('ArrowDown');if(up!==down)movePaddle((player===1?p1:p2)+(up?-9:9))}requestAnimationFrame(controls)}controls();
})();
