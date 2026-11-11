const socket = io("/milhao");
const $ = id => document.getElementById(id);
const screens = ["landing","lobby","game","finished"];
let mode = "create", roomCode = "", myId = "", state = null, myName = "", submitted = false, usedHelps = new Set(), eliminated = [], localVotes = null, toastTimer;
const keys = ["A","B","C","D"];
function showScreen(name){screens.forEach(s=>$(s).classList.toggle("hidden",s!==name));}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2500);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function initials(s){return (s||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();}
function emitAck(event,data){return new Promise(resolve=>socket.emit(event,data||{},resolve));}
socket.on("connect",()=>{$("connectionLabel").textContent="SISTEMA ONLINE";document.body.classList.remove("connection-off");});
socket.on("disconnect",()=>{$("connectionLabel").textContent="RECONECTANDO";document.body.classList.add("connection-off");});
document.querySelectorAll(".switch").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.mode;document.querySelectorAll(".switch").forEach(x=>x.classList.toggle("active",x===b));$("codeWrap").classList.toggle("hidden",mode!=="join");$("difficultyWrap").classList.toggle("hidden",mode!=="create");$("enterLabel").textContent=mode==="create"?"Criar minha sala":"Entrar na sala";$("entryError").textContent="";}));
$("enterBtn").addEventListener("click",async()=>{
  myName=$("playerName").value.trim();$("entryError").textContent="";
  if(!myName){$("entryError").textContent="Digite seu nome ou apelido para continuar.";return;}
  $("enterBtn").disabled=true;
  try{
    const result=mode==="create"?await emitAck("room:create",{name:myName,level:$("difficultySelect").value}):await emitAck("room:join",{name:myName,code:$("roomCode").value.trim()});
    if(!result?.ok){$("entryError").textContent=result?.error||"Não foi possível entrar.";return;}
    roomCode=result.code;myId=result.playerId;showScreen("lobby");
  }catch(e){$("entryError").textContent="Falha na conexão. Tente novamente.";}
  finally{$("enterBtn").disabled=false;}
});
$("roomCode").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));
$("copyCode").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(roomCode);toast("Código copiado!");}catch{toast("Código da sala: "+roomCode);}});
$("startBtn").addEventListener("click",async()=>{const r=await emitAck("game:start",{});if(!r?.ok)toast(r?.error||"Não foi possível iniciar.");});
document.querySelectorAll(".help-btn").forEach(b=>b.addEventListener("click",async()=>{
  const type=b.dataset.help;
  if(usedHelps.has(type)||submitted)return;
  const r=await emitAck("game:help",{type});
  if(!r?.ok){toast(r?.error||"Ajuda indisponível.");return;}
  usedHelps.add(type);b.disabled=true;
  if(type==="fifty"){eliminated=r.data.eliminated||[];renderAnswers();}
  if(type==="audience"){localVotes=r.data.votes;renderAudience();}
  if(type==="skip"){submitted=true;disableAnswers();toast("Pergunta pulada.");}
}));
function renderLobby(s){
  $("lobbyCode").textContent=s.code;
  $("arenaLevel").textContent="NÍVEL: "+(s.levelLabel||"APRENDIZ").toUpperCase();
  $("arenaLevel").textContent="NÍVEL: "+(s.levelLabel||"APRENDIZ").toUpperCase();
  $("playerCount").textContent=`${s.players.length} JOGADOR${s.players.length===1?"":"ES"}`;
  $("lobbyPlayers").innerHTML=s.players.map((p,i)=>`<div class="lobby-player"><div class="avatar">${esc(initials(p.name))}</div><div style="min-width:0"><b>${esc(p.name)}</b><small>${p.connected?"Conectado":"Reconectando..."} • ${"❤️".repeat(p.lives??3)}${"🖤".repeat(3-(p.lives??3))} ${p.lives??3}/3 vidas</small></div>${p.id===s.hostId?'<span class="host-tag">ANFITRIÃO</span>':""}</div>`).join("");
  const isHost=s.hostId===myId;
  $("startBtn").classList.toggle("hidden",!isHost);
  $("lobbyHint").textContent=isHost?(s.players.length<2?"Convide pelo menos mais um jogador para começar.":"Tudo pronto? Você pode iniciar a partida."):"Aguardando o anfitrião iniciar a partida…";
}
function renderQuestion(s){
  const q=s.question;if(!q)return;
  $("roundNumber").textContent=String(q.number).padStart(2,"0");
  $("categoryTag").textContent=q.category.toUpperCase();
  $("questionCounter").textContent=`RODADA ${String(q.number).padStart(2,"0")}`;
  $("questionPrize").textContent=`+${q.prize.toLocaleString("pt-BR")} PONTOS • SEM TETO`;
  $("questionText").textContent=q.q;
  $("timerValue").textContent=s.timeLeft;
  $("timerRing").classList.toggle("urgent",s.timeLeft<=7);
  $("progressBar").style.width=`${((q.number-1)/q.total)*100}%`;
  const me=s.players.find(p=>p.id===myId);
  if(me?.eliminated){$("resultBox").classList.remove("hidden");$("resultBox").classList.add("bad");$("resultBox").innerHTML="💀 Você foi eliminado! Aguarde o campeão.";disableAnswers();return;}
  if(me && !me.answered && !submitted && !s.results){$("resultBox").classList.add("hidden");}
  if(s.results){renderResult(s);return;}
  renderAnswers();
  renderHelpButtons();
  renderRanking(s);
  const current=s.players.find(p=>p.id===myId);
  $("myScore").innerHTML=`${(current?.score||0).toLocaleString("pt-BR")} <small>PTS</small>`;
  renderPrizeLadder(q.number);
}
function renderAnswers(){
  const q=state?.question;if(!q)return;
  const me=state.players.find(p=>p.id===myId);
  const locked=submitted||me?.answered||state.status!=="playing";
  $("answers").innerHTML=q.a.map((answer,i)=>`<button class="answer-btn ${eliminated.includes(i)?"eliminated":""}" data-index="${i}" ${locked||eliminated.includes(i)?"disabled":""}><span class="answer-key">${keys[i]}</span><span>${esc(answer)}</span></button>`).join("");
  $("answers").querySelectorAll(".answer-btn").forEach(b=>b.addEventListener("click",async()=>{
    const idx=Number(b.dataset.index);if(submitted)return;
    submitted=true;document.querySelectorAll(".answer-btn").forEach(x=>x.disabled=true);b.classList.add("selected");
    const r=await emitAck("game:answer",{index:idx});
    if(!r?.ok){submitted=false;toast(r?.error||"Resposta não enviada.");}
  }));
}
function disableAnswers(){document.querySelectorAll(".answer-btn").forEach(b=>b.disabled=true);}
function renderHelpButtons(){document.querySelectorAll(".help-btn").forEach(b=>b.disabled=usedHelps.has(b.dataset.help)||submitted||state.status!=="playing"||state.players.find(p=>p.id===myId)?.answered);}
function renderAudience(){if(!localVotes)return;const labels=["A","B","C","D"];$("audienceBox").classList.remove("hidden");$("audienceBox").innerHTML=`<h4>VOTAÇÃO DA PLATEIA</h4>`+localVotes.map((v,i)=>`<div class="vote-row"><b>${labels[i]}</b><div class="vote-track"><i style="width:${v}%"></i></div><span>${v}%</span></div>`).join("");}
function renderResult(s){
  const result=s.results?.results?.find(r=>r.id===myId);
  $("answers").querySelectorAll(".answer-btn").forEach((b,i)=>{b.disabled=true;if(i===s.results.correctIndex)b.classList.add("correct");if(result&&result.answer===i&&!result.correct)b.classList.add("wrong");});
  $("resultBox").classList.remove("hidden");$("resultBox").classList.toggle("bad",!result?.correct);
  $("resultBox").innerHTML=`<b>${result?.correct?"⚡ ACERTOU! VOCÊ SOBREVIVEU!":result?.timedOut?"⏱️ TEMPO ESGOTADO!":"❌ RESPOSTA ERRADA!"}</b>${esc(s.results.explanation||"")} ${result?.correct?`<br>+${result.points.toLocaleString("pt-BR")} pontos nesta rodada. ❤️ ${result.lives??3}/3 vidas restantes.`:`<br>Você perdeu uma vida. ❤️ ${result?.lives??0}/3 vidas restantes. ${result?.eliminated?"Suas 3 vidas acabaram. Você foi eliminado!":"Continue na disputa!"}`}`;
  $("progressBar").style.width=`${(s.question.number/s.question.total)*100}%`;
  renderRanking(s);renderHelpButtons();
}
function renderRanking(s){
  const sorted=[...s.players].sort((a,b)=>b.score-a.score||b.correct-a.correct);
  $("rankingList").innerHTML=sorted.map((p,i)=>`<div class="rank-row ${p.id===myId?"me":""}"><span class="rank-num">${String(i+1).padStart(2,"0")}</span><span class="rank-avatar">${esc(initials(p.name))}</span><span class="rank-name">${esc(p.name)}${p.id===myId?" (você)":""}<small>${p.eliminated?"💀 ELIMINADO":p.correct+" acerto"+(p.correct===1?"":"s")+(p.answered&&s.status==="playing"?" • respondeu":"")} • ❤️ ${p.lives??3}/3 vidas</small></span><span class="rank-points">${p.score.toLocaleString("pt-BR")}<small> PTS</small></span></div>`).join("");
  const me=s.players.find(p=>p.id===myId);$("myScore").innerHTML=`${(me?.score||0).toLocaleString("pt-BR")} <small>PTS</small>`;
}
function renderPrizeLadder(current){
  const prizes=state.prizes||[];
  $("prizeList").innerHTML=prizes.slice(0,8).map((v,i)=>`<div class="prize-step ${i+1===current?"current":i+1<current?"done":""}"><span>${String(i+1).padStart(2,"0")} · Pergunta ${i+1}</span><b>${v.toLocaleString("pt-BR")}</b></div>`).join("");
}
function renderFinished(s){
  $("finishSubtitle").textContent=s.finishReason==="last-survivor"?`👑 ${s.winner} é o último sobrevivente da arena!`:s.finishReason==="question-bank"?`🏆 Banco de perguntas concluído! ${s.winner} venceu pelo maior placar.`:"A arena terminou sem sobreviventes. Que disputa!";
  const sorted=[...s.players].sort((a,b)=>b.score-a.score||b.correct-a.correct);
  $("finalRanking").innerHTML=sorted.map((p,i)=>`<div class="rank-row ${p.id===myId?"me":""}"><span class="rank-num">${i===0?"♛":String(i+1).padStart(2,"0")}</span><span class="rank-avatar">${esc(initials(p.name))}</span><span class="rank-name">${esc(p.name)}<small>${p.correct} acertos • ❤️ ${p.lives??3}/3 vidas</small></span><span class="rank-points">${p.score.toLocaleString("pt-BR")}<small> PTS</small></span></div>`).join("");
  showScreen("finished");
}
socket.on("room:update",s=>{
  state=s;roomCode=s.code;
  if(s.status==="lobby"){showScreen("lobby");renderLobby(s);return;}
  if(s.status==="playing"||s.status==="reveal"){showScreen("game");if(s.status==="playing"&&!s.results){const qn=s.question?.number;if(window._lastQuestion!==qn){window._lastQuestion=qn;submitted=false;eliminated=[];localVotes=null;$("audienceBox").classList.add("hidden");usedHelps=new Set();document.querySelectorAll(".help-btn").forEach(b=>b.disabled=false);}renderQuestion(s);}else{renderQuestion(s);}return;}
  if(s.status==="finished"){renderFinished(s);}
});
$("newGameBtn").addEventListener("click",()=>{location.reload();});
