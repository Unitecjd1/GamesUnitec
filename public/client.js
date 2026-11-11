const socket = io("/bomba");
const $ = id => document.getElementById(id);
const sections = ["entry","lobby","game","single","finished"];
let roomState = null;
let myId = null;
let timerFrame = null;
let lastExplosion = 0;
const socketIdReady = new Promise(resolve => socket.on("connect", () => { myId = socket.id; resolve(); }));
function showSection(id){ sections.forEach(s => $(s).classList.toggle("hidden",s!==id)); }
function toast(msg){ const el=$("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2400); }
function entryError(msg){$("entryError").textContent=msg||"";}
function emitAck(event,payload){return new Promise(resolve=>socket.emit(event,payload||{},resolve));}
function nameValue(){return $("playerName").value.trim();}
async function createRoom(){
  entryError("");
  const r=await emitAck("room:create",{name:nameValue()});
  if(!r?.ok){entryError(r?.error||"Não foi possível criar a sala.");return;}
  $("roomCode").textContent=r.code; $("gameRoomCode").textContent=r.code;
  showSection("lobby");
}
async function joinRoom(){
  entryError("");
  const r=await emitAck("room:join",{name:nameValue(),code:$("roomCodeInput").value});
  if(!r?.ok){entryError(r?.error||"Não foi possível entrar.");return;}
  $("roomCode").textContent=r.code; $("gameRoomCode").textContent=r.code;
  showSection("lobby");
}
$("createBtn").addEventListener("click",createRoom);
$("joinBtn").addEventListener("click",joinRoom);
$("playerName").addEventListener("keydown",e=>{if(e.key==="Enter")createRoom()});
$("roomCodeInput").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));
$("copyCode").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("roomCode").textContent);toast("Código copiado!")}catch{toast("Código da sala: "+$("roomCode").textContent)}});
$("startBtn").addEventListener("click",async()=>{const r=await emitAck("game:start");if(!r?.ok)toast(r?.error||"Não foi possível iniciar.")});
$("wordForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const input=$("wordInput"); if(!input.value.trim())return;
  const r=await emitAck("word:submit",{word:input.value});
  $("wordFeedback").textContent=r?.message||r?.error||"";
  $("wordFeedback").className="feedback "+(r?.ok?"good":"bad");
  if(r?.ok)input.value="";
  else { input.select(); }
});
$("backBtn").addEventListener("click",()=>location.reload());
socket.on("connect",()=>{myId=socket.id;});
let visualCountdownTimer=null;
function startVisualCountdown(endsAt){
  const overlay=$("countdownOverlay"); if(!overlay)return;
  if(visualCountdownTimer)clearInterval(visualCountdownTimer);
  overlay.classList.remove("hidden");
  visualCountdownTimer=setInterval(()=>{
    const left=Math.max(0,Math.ceil((endsAt-Date.now())/1000));
    overlay.querySelector("strong").textContent=left>0?String(left):"GO!";
    if(left<=0){clearInterval(visualCountdownTimer);visualCountdownTimer=null;setTimeout(()=>overlay.classList.add("hidden"),550);}
  },100);
}
socket.on("room:update",state=>{
  roomState=state;
  $("roomCode").textContent=state.code;$("gameRoomCode").textContent=state.code;
  $("playerCount").textContent=`${state.players.length} / 20`;
  const host=state.hostId===socket.id;
  $("hostArea").classList.toggle("hidden",!host||state.status!=="lobby");
  $("waitingText").classList.toggle("hidden",state.status!=="lobby"||host);
  $("lobbyPlayers").innerHTML=state.players.map(p=>`<div class="player-chip ${p.id===socket.id?"me":""}">${esc(p.name)}${p.id===socket.id?'<span class="mini">VOCÊ</span>':""}</div>`).join("");
  if(state.status==="lobby")showSection("lobby");
  if(state.status==="countdown"){ showSection("game"); startVisualCountdown(state.countdownEndsAt); }
  if(state.status==="playing"){
    showSection("game");
    $("roundNum").textContent=String(state.round).padStart(2,"0");
    $("aliveCount").textContent=state.players.filter(p=>p.alive).length;
    const difficultyNames=["","FÁCIL","INTERMEDIÁRIO","AVANÇADO","EXTREMO"];
    $("gameMessage").textContent=state.message||"";
    const previousWord=$("wordPrompt").textContent;
    $("wordPrompt").dataset.difficulty=difficultyNames[state.difficulty||1]||"";
    $("wordPrompt").setAttribute("title","Dificuldade: "+(difficultyNames[state.difficulty||1]||""));
    if(previousWord !== (state.currentWord||"…")) $("wordInput").value="";
    const me=state.players.find(p=>p.id===socket.id);
    $("myScore").textContent=me?.score??0;
    $("wordPrompt").textContent=state.currentWord||"…";
    $("wordPrompt").classList.toggle("hard-word", (state.difficulty||1)>=3);
    $("wordExplanation").textContent=wordMeaning(state.currentWord);
    $("gameMessage").textContent=state.message||"";
    const holding=state.bombHolderId===socket.id;
    $("wordInput").disabled=!holding;
    $("wordForm").querySelector("button").disabled=!holding;
    if(holding){$("wordFeedback").textContent="A bomba está com você! Digite rápido!";$("wordFeedback").className="feedback";if(document.activeElement!==$("wordInput"))$("wordInput").focus();}
    else if(me&&!me.alive){$("wordFeedback").textContent="Você foi eliminado. Continue acompanhando!";$("wordFeedback").className="feedback bad";}
    else {$("wordFeedback").textContent="Aguarde a bomba chegar até você...";$("wordFeedback").className="feedback";}
    const sorted=[...state.players].sort((a,b)=>(b.alive-a.alive)||(b.score-a.score)||a.name.localeCompare(b.name));
    $("scorePlayers").innerHTML=sorted.map((p,i)=>`<div class="score-row ${p.id===state.bombHolderId?"holder":""} ${p.alive?"":"dead"}"><span class="rank">${String(i+1).padStart(2,"0")}</span><span class="score-name">${esc(p.name)}${p.id===socket.id?" <small>VOCÊ</small>":""}<small>${p.alive?(p.id===state.bombHolderId?"💣 COM A BOMBA":"● SOBREVIVENTE"):"✕ ELIMINADO"} · ${p.correct} acertos</small></span><span class="score-value">${p.score}</span></div>`).join("");
  }
  if(state.status==="finished")renderFinished(state);
});
socket.on("game:explosion",data=>{lastExplosion=Date.now();$("bomb").classList.add("urgent");toast("💥 BOOM! "+data.playerName+" foi eliminado!");setTimeout(()=>$("bomb").classList.remove("urgent"),1200)});
socket.on("game:finished",()=>{if(roomState)renderFinished({...roomState,status:"finished"})});
function renderFinished(state){
  showSection("finished");
  const winner=state.players.find(p=>p.id===state.winnerId);
  $("winnerTitle").textContent=winner?winner.name+" VENCEU!":"FIM DE JOGO!";
  $("winnerMessage").textContent=winner?"Último sobrevivente da Bomba da Informática!":"A partida terminou sem vencedor.";
  const sorted=[...state.players].sort((a,b)=>(b.alive-a.alive)||(b.score-a.score)||(b.correct-a.correct));
  $("finalRanking").innerHTML=sorted.map((p,i)=>`<div class="final-row"><span>${["🥇","🥈","🥉"][i]||"#"+(i+1)} ${esc(p.name)}</span><b>${p.score} pts · ${p.correct} acertos</b></div>`).join("");
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

// Glossário rápido: explicações curtas para aprender durante a partida.
const meanings = {
 "MOUSE":"Mouse: dispositivo usado para movimentar o ponteiro e selecionar itens na tela.",
 "TECLADO":"Teclado: dispositivo com teclas usado para digitar letras, números e comandos.",
 "MONITOR":"Monitor: tela que exibe as imagens e informações do computador.",
 "WINDOWS":"Windows: sistema operacional que permite usar programas e organizar arquivos.",
 "PASTA":"Pasta: local usado para guardar e organizar arquivos no computador.",
 "ARQUIVO":"Arquivo: documento, imagem, vídeo ou outro conteúdo salvo no computador.",
 "INTERNET":"Internet: rede mundial que conecta computadores e permite acessar sites e serviços.",
 "HARDWARE":"Hardware: parte física do computador, como teclado, memória e monitor.",
 "SOFTWARE":"Software: programas e sistemas que funcionam no computador.",
 "NAVEGADOR":"Navegador: programa usado para acessar páginas e sites da internet.",
 "PROCESSADOR":"Processador: componente que executa instruções e realiza cálculos.",
 "MEMORIA":"Memória RAM: espaço temporário usado pelos programas enquanto estão abertos.",
 "PLANILHA":"Planilha: documento organizado em linhas e colunas, muito usado para cálculos.",
 "ATALHO":"Atalho: combinação de teclas ou ícone que permite executar uma ação rapidamente.",
 "PERIFERICO":"Periférico: equipamento conectado ao computador, como impressora, mouse ou teclado.",
 "PLACA MAE":"Placa-mãe: placa principal que conecta os componentes do computador.",
 "SISTEMA":"Sistema operacional: programa principal que controla o computador e seus recursos.",
 "DOWNLOAD":"Download: ação de baixar um arquivo da internet para seu dispositivo.",
 "SEGURANCA":"Segurança digital: cuidados para proteger dados, contas e equipamentos.",
 "COMPATIBILIDADE":"Compatibilidade: capacidade de programas e equipamentos funcionarem juntos.",
 "ALGORITMO":"Algoritmo: sequência organizada de passos para resolver um problema.",
 "FIREWALL":"Firewall: recurso que ajuda a controlar conexões e bloquear acessos indesejados.",
 "BANCO DE DADOS":"Banco de dados: conjunto organizado de informações que podem ser consultadas.",
 "ARMAZENAMENTO":"Armazenamento: local onde os dados ficam guardados, como HD, SSD ou pen drive.",
 "GABINETE":"Gabinete: estrutura que abriga e protege as peças internas do computador.",
 "IMPRESSORA":"Impressora: equipamento que coloca textos e imagens no papel.",
 "RESOLUCAO":"Resolução: quantidade de detalhes exibidos em uma imagem ou tela.",
 "PROGRAMACAO":"Programação: criação de instruções que dizem ao computador o que fazer."
};
function wordMeaning(word){
  const key=String(word||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  return meanings[key] || "Conceito de informática: observe a palavra e pense em como ela é usada no dia a dia com computadores.";
}

// Reações aparecem para todos os participantes conectados à sala.
$("emojiBar").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-emoji]");
  if(btn) socket.emit("lobby:emoji",{emoji:btn.dataset.emoji});
});
socket.on("lobby:emoji",data=>{
  const feed=$("lobbyReactions");
  const item=document.createElement("div");
  item.className="reaction-item";
  item.textContent=data.emoji+" ";
  const name=document.createElement("b");
  name.textContent=data.playerName;
  item.appendChild(name);
  feed.appendChild(item);
  while(feed.children.length>16)feed.removeChild(feed.firstChild);
  setTimeout(()=>item.remove(),9000);
});

// Treinamento individual com instruções e desafios em três níveis.
const training = [
 {level:"NÍVEL 1",title:"Conhecendo o teclado",tip:"Comece devagar. Mantenha os dedos relaxados e procure olhar para a tela enquanto digita.",tasks:["CASA","TECLADO","MOUSE","ESCOLA","COMPUTADOR"]},
 {level:"NÍVEL 2",title:"Palavras de informática",tip:"Agora pratique palavras comuns da informática. Preste atenção em cada letra e nos espaços.",tasks:["INTERNET","MONITOR","ARQUIVO","PASTA","IMPRESSORA","PROGRAMA"]},
 {level:"NÍVEL 3",title:"Frases do dia a dia",tip:"Chegou a hora de digitar frases. Respeite os espaços e a pontuação.",tasks:["EU GOSTO DE INFORMATICA.","O TECLADO SERVE PARA DIGITAR.","SALVE SEUS ARQUIVOS EM UMA PASTA.","A INTERNET CONECTA PESSOAS E COMPUTADORES."]}
];
let trainingIndex=0, trainingCorrect=0, trainingAttempts=0, trainingPassed=false, singleSeconds=15, singleClock=null, singleCountdown=null, singleIntroPending=true;
function normalizedTyping(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();}
function currentTask(){let flat=training.flatMap((level,li)=>level.tasks.map((task,ti)=>({level,li,ti,task})));return flat[trainingIndex];}
function renderTraining(){
  const item=currentTask();
  if(!item){$("lessonLevel").textContent="CONCLUÍDO";$("lessonTitle").textContent="Treinamento concluído!";$("lessonTip").textContent="Parabéns! Você completou todos os desafios. Continue praticando para ganhar velocidade e precisão.";$("singlePrompt").textContent="🏆 PARABÉNS!";$("singleInput").disabled=true;$("singleForm").classList.add("hidden");$("singleNext").classList.remove("hidden");$("singleNext").textContent="RECOMEÇAR TREINAMENTO";$("lessonProgress").style.width="100%";return;}
  $("lessonLevel").textContent=item.level.level;
  $("lessonTitle").textContent=item.level.title;
  $("lessonTip").textContent=item.level.tip;
  $("singlePrompt").textContent=item.task;
  $("singleExplanation").textContent=wordMeaning(item.task.replace(/[.]/g,"")) || "Pratique a digitação com atenção às letras e aos espaços.";
  $("singleInput").value="";$("singleInput").disabled=true;
  const showIntro=singleIntroPending; singleIntroPending=false;
  startSingleRound(showIntro);
  $("singleFeedback").textContent="Digite o texto e pressione Conferir.";
  $("singleFeedback").className="feedback";
  $("singleNext").classList.add("hidden");
  $("singleForm").classList.remove("hidden");
  $("lessonProgress").style.width=(trainingIndex/training.flatMap(x=>x.tasks).length*100)+"%";
}
function stopSingleClocks(){if(singleClock)clearInterval(singleClock);if(singleCountdown)clearInterval(singleCountdown);singleClock=null;singleCountdown=null;}
function startSingleRound(showCountdown=false){
  stopSingleClocks(); singleSeconds=15; $("singleTimer").textContent="15s"; $("singleTimerFill").style.width="100%"; $("singleTimer").classList.remove("urgent");
  const overlay=$("countdownOverlay");
  const launchClock=()=>{
    $("singleInput").disabled=false;$("singleInput").focus();
    singleClock=setInterval(()=>{singleSeconds--;$("singleTimer").textContent=singleSeconds+"s";$("singleTimerFill").style.width=(singleSeconds/15*100)+"%";if(singleSeconds<=5)$("singleTimer").classList.add("urgent");if(singleSeconds<=0){stopSingleClocks();$("singleInput").disabled=true;trainingAttempts++;updateTrainingStats();$("singleFeedback").textContent="⏰ Tempo esgotado! Vamos tentar novamente.";$("singleFeedback").className="feedback bad";$("singleNext").textContent="TENTAR NOVAMENTE ↻";$("singleNext").classList.remove("hidden");$("singleForm").classList.add("hidden");}},1000);
  };
  if(showCountdown){
    overlay.classList.remove("hidden"); let count=3; overlay.querySelector("strong").textContent="3";
    singleCountdown=setInterval(()=>{count--;overlay.querySelector("strong").textContent=count>0?String(count):"GO!";
      if(count<=0){clearInterval(singleCountdown);singleCountdown=null;setTimeout(()=>overlay.classList.add("hidden"),450);launchClock();}
    },1000);
  } else {
    overlay.classList.add("hidden"); launchClock();
  }
}
function updateTrainingStats(){
  $("singleCorrect").textContent=trainingCorrect;
  $("singleAttempts").textContent=trainingAttempts;
  $("singleAccuracy").textContent=(trainingAttempts?Math.round(trainingCorrect/trainingAttempts*100):0)+"%";
}
function beginTraining(){trainingIndex=0;trainingCorrect=0;trainingAttempts=0;trainingPassed=false;singleIntroPending=true;updateTrainingStats();showSection("single");renderTraining();}
$("singleBtn").addEventListener("click",beginTraining);
$("singleBack").addEventListener("click",()=>showSection("entry"));
$("restartSingle").addEventListener("click",beginTraining);
$("singleForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(trainingPassed)return;
  const item=currentTask();if(!item)return;
  trainingAttempts++;
  if(normalizedTyping($("singleInput").value)===normalizedTyping(item.task)){
    trainingCorrect++;trainingPassed=true;stopSingleClocks();
    $("singleFeedback").textContent="Muito bem! Texto digitado corretamente. 🎉";
    $("singleFeedback").className="feedback good";
    $("singleInput").disabled=true;
    $("singleNext").classList.remove("hidden");
    $("singleNext").textContent=trainingIndex===training.flatMap(x=>x.tasks).length-1?"FINALIZAR TREINAMENTO":"PRÓXIMO DESAFIO →";
  }else{
    $("singleFeedback").textContent="Ainda não está igual. Confira as letras e tente novamente.";
    $("singleFeedback").className="feedback bad";
    $("singleInput").select();
  }
  updateTrainingStats();
});
$("singleNext").addEventListener("click",()=>{
  if(trainingIndex>=training.flatMap(x=>x.tasks).length){beginTraining();return;}
  if(!trainingPassed){$("singleForm").classList.remove("hidden");trainingPassed=false;renderTraining();return;}
  trainingIndex++;trainingPassed=false;renderTraining();
});

// Client display timer is visual only; server owns the actual deadline.
function animateTimer(){
  if(roomState?.status==="playing"&&roomState.deadline){
    const left=Math.max(0,roomState.deadline-Date.now());
    const total=19000;
    $("timerText").textContent=(left/1000).toFixed(1)+"s";
    $("timerFill").style.width=Math.min(100,left/total*100)+"%";
    const urgent=left<4500;
    $("timerText").classList.toggle("urgent",urgent);
    $("bomb").classList.toggle("urgent",urgent);
  }else{
    $("timerText").textContent="--.-s";$("timerFill").style.width="100%";$("timerText").classList.remove("urgent");
  }
  requestAnimationFrame(animateTimer);
}
animateTimer();
