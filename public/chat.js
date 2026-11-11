(() => {
  const socket = io();
  const $ = id => document.getElementById(id);
  const messages = $('chatMessages'), nameInput = $('chatName'), joinBtn = $('chatJoin');
  const textInput = $('chatText'), sendBtn = $('chatSend'), form = $('chatForm');
  if (!messages || !nameInput || !joinBtn || !textInput || !sendBtn || !form) return;
  let joined = false;
  function addMessage(m) {
    const empty = messages.querySelector('.chat-empty'); if (empty) empty.remove();
    const item = document.createElement('div'); item.className = 'chat-message';
    const meta = document.createElement('div'); meta.className = 'chat-meta';
    const who = document.createElement('span'); who.textContent = m.name;
    const time = document.createElement('span'); time.className = 'chat-time'; time.textContent = new Date(m.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const body = document.createElement('p'); body.textContent = m.text;
    meta.append(who,time); item.append(meta,body); messages.append(item); messages.scrollTop = messages.scrollHeight;
  }
  function notice(text) { const el=document.createElement('div'); el.className='chat-notice'; el.textContent=text; messages.append(el); messages.scrollTop=messages.scrollHeight; }
  function join() { const name=nameInput.value.trim(); if(!name){nameInput.focus();return;} socket.emit('chat:join',{name}); }
  joinBtn.addEventListener('click',join); nameInput.addEventListener('keydown',e=>{if(e.key==='Enter')join();});
  socket.on('chat:history', list => { messages.innerHTML=''; if(!list.length){messages.innerHTML='<div class="chat-empty">As conversas aparecerão aqui. Seja respeitoso! 👋</div>';return;} list.forEach(addMessage); });
  socket.on('chat:joined', data => { joined=true; nameInput.disabled=true; joinBtn.disabled=true; joinBtn.textContent='CONECTADO'; textInput.disabled=false; sendBtn.disabled=false; textInput.focus(); notice('Você entrou no chat como '+data.name+'.'); });
  socket.on('chat:message',addMessage); socket.on('chat:notice',d=>notice(d.text));
  socket.on('chat:error',msg=>notice(msg));
  form.addEventListener('submit',e=>{e.preventDefault();const text=textInput.value.trim();if(!joined||!text)return;socket.emit('chat:send',{text});textInput.value='';textInput.focus();});
})();
