(function(){
  const layer=document.createElement('div');
  layer.id='holidayLayer';
  layer.innerHTML='<div class="holiday-ribbon"></div><div class="holiday-snow"></div><img id="holidayGif" src="/img/natal-passar.gif" alt=""><div class="holiday-corner left">🎄✨</div><div class="holiday-corner right">🎁✨</div>';
  document.body.appendChild(layer);
  const mode=document.createElement('div'); mode.className='holiday-mode'; mode.textContent='🎄 MODO FINAL DE ANO ATIVADO • NATAL + ANO NOVO'; document.body.appendChild(mode);
  const msg=document.createElement('div'); msg.className='holiday-message'; msg.innerHTML='🎄 <b>Boas festas, Alunos !!!</b> ✨ &nbsp; Att: Prof Guilherme Almeida &nbsp; 🎆'; document.body.appendChild(msg);
})();
