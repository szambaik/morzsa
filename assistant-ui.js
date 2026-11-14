// A single, context-aware text/voice entry point. Direct pantry/list actions stay local.
window.MorzsaAssistant=(()=>{
 const say=(hu,en)=>language==='en'?en:hu;
 const searchIcon='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg>';
 function mount(){
  if(!['overview','pantry','shopping'].includes(page))return;if(page==='shopping'&&window.ShoppingMode?.visible()){main.querySelector('.assistant-dock')?.remove();return}
  if(page==='overview'){main.querySelector('.dashboard-assistant')?.remove();main.querySelector('.assistant-dock')?.remove();return}
  main.querySelectorAll('.assistant-dock,.pantry-voice-fab,.pantry-search-fab').forEach(el=>el.remove());
  const dock=document.createElement('div');dock.className='assistant-dock';dock.setAttribute('data-no-translate','');
  const placeholder=page==='shopping'?say('Mit írjunk a listára?','What goes on the list?'):page==='pantry'?say('Mi változott otthon?','What changed at home?'):say('Mondd el Morzsának…','Tell Morzsa…');
  dock.innerHTML='<button class="assistant-open" data-assistant-text aria-label="'+say('Beszélgetés Morzsával','Chat with Morzsa')+'"><img src="assets/brands/morzsa.svg" width="25" height="25" alt=""><span>'+placeholder+'</span></button>'+(page==='pantry'?'<button class="assistant-manual" data-assistant-manual aria-label="'+say('Keresés és kézi felvétel','Search and add manually')+'">'+searchIcon+'</button>':'')+'<button class="assistant-mic" data-assistant-voice aria-label="'+say('Beszélgetés Morzsával hanggal','Talk to Morzsa by voice')+'">'+voiceMicIcon+'</button>';
  dock.querySelector('[data-assistant-text]').onclick=()=>window.MorzsaCompanion?window.MorzsaCompanion.open():openVoiceCommand('text');dock.querySelector('[data-assistant-voice]').onclick=()=>openVoiceCommand();dock.querySelector('[data-assistant-manual]')?.addEventListener('click',openPantryEntry);main.append(dock);
 }
 const pantry=renderPantry,shopping=renderShopping,overview=renderDashboard;
 renderPantry=function(){pantry();mount()};renderShopping=function(){shopping();mount()};renderDashboard=function(){overview();mount()};
 mount();return {mount};
})();
