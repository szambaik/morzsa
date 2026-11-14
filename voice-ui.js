const voiceMicIcon='<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
const voiceContext=()=>JSON.stringify([window.household?.userId(),window.household?.active]);
async function saveVoiceState(next){if(window.household?.busy||window.household?.cartPending)return false;if(window.household?.active){state=next;return !!await window.household.notify()}return commitState(next)}
function voiceError(error){
 const en=language==='en',messages={
 PLUS_API_QUOTA:['Az OpenAI API-kerete elfogyott, vagy még nincs aktiválva a számlázás. Ellenőrizd az API-projekt Billing oldalát; a ChatGPT-előfizetés külön szolgáltatás.','Your OpenAI API balance is exhausted or billing is not activated. Check the API project’s Billing page; a ChatGPT subscription is separate.'],
 PLUS_SETUP_REQUIRED:['A Plus módhoz még be kell kötni az OpenAI API-kulcsot és a szerveroldali funkciót. Addig a chatben választhatsz ingyenes módot.','Plus needs the OpenAI API key and server function configured. You can select Free in the chat.'],
 PLUS_ACCESS_REQUIRED:['A fiókodhoz vagy konyhádhoz még nincs Plus-hozzáférés beállítva. A chatben választhatod az ingyenes módot.','Plus access is not enabled for your account or kitchen yet. Select Free in the chat.'],
 PLUS_LIMIT:['A Plus használati keret elfogyott. A chatben ingyenes módra válthatsz.','Your Plus allowance is used up. Switch to Free in the chat.'],
 PLUS_REQUEST_PENDING:['Ez a kérés vagy hangbeszélgetés már folyamatban van. Várj, vagy fejezd be az előzőt.','This request or voice conversation is already in progress. Wait or end the previous one.'],
 VOICE_SIGN_IN_REQUIRED:['Morzsa AI-segítségéhez előbb lépj be.','Sign in to use Morzsa’s AI assistant.'],
 VOICE_SETUP_REQUIRED:['A hangfelismerés még nincs bekötve. Addig használd a szöveges felvételt.','Voice is not configured yet. You can use text entry in the meantime.'],
 VOICE_DAILY_LIMIT:['Mára elfogyott az asszisztens kerete. A kézi felvétel továbbra is használható.','The daily assistant limit has been reached. Manual entry is still available.'],
 VOICE_INVALID_RESPONSE:['Az AI válasza hiányos vagy hibás formátumú volt. Próbáld újra; semmit nem módosítottunk.','The AI response was incomplete or malformed. Try again; nothing was changed.'],
 VOICE_PROVIDER_BUSY:['Az AI-szolgáltatás most túlterhelt. Próbáld újra kicsit később.','The AI service is currently busy. Try again shortly.'],
 VOICE_PROVIDER_LIMIT:['Az AI-szolgáltató kérési korlátjába ütköztünk. Próbáld később újra; ez nem feltétlenül napi korlát.','The AI provider has reached a request limit. Try again later; this is not necessarily a daily limit.'],
 VOICE_TIMEOUT:['Az AI válasza túl sokáig tartott. Próbáld újra; semmit nem módosítottunk.','The AI response timed out. Try again; nothing was changed.'],
 VOICE_PROVIDER_ERROR:['Az AI-szolgáltató elutasította a kérést. Ez technikai hiba; semmit nem módosítottunk.','The AI provider rejected the request. This is a technical error; nothing was changed.'],
 VOICE_UNSUPPORTED:['Ebben a böngészőben nem elérhető a hangfelvétel. Használd a szöveges felvételt.','Recording is not available in this browser. Use text entry.'],
 VOICE_TOO_LARGE:['A felvétel túl nagy. Próbálj rövidebb üzenetet.','Recording is too large. Try a shorter message.'],
 VOICE_CHANGED:['Közben megváltozott a fiók vagy a háztartás. Kezdd újra a felvételt.','Account or household changed. Start a new recording.'],
 NotAllowedError:window.MorzsaNative?['Engedélyezd a mikrofont a telefon beállításaiban a Morzsának, vagy használd a szöveges felvételt.','Allow Morzsa microphone access in your phone settings, or use text entry.']:['Engedélyezd a mikrofont a böngészőben, vagy használd a szöveges felvételt.','Allow microphone access in your browser, or use text entry.'],
 NotFoundError:['Nem található mikrofon. Használd a szöveges felvételt.','No microphone found. Use text entry.']};
 return (messages[error?.message]||messages[error?.name]||['Morzsa most nem tud válaszolni. Semmit sem módosítottunk. Próbáld újra.','Morzsa cannot respond right now. Nothing was changed. Try again.'])[en?1:0];
}
let voiceUndoTimer;
function showVoiceUndo(changes,context){
 clearInterval(voiceUndoTimer);document.getElementById('voice-undo')?.remove();if(!changes.length)return;
 const say=(hu,en)=>language==='en'?en:hu,el=document.createElement('div');el.id='voice-undo';el.className='voice-undo';el.setAttribute('data-no-translate','');el.setAttribute('role','status');
 el.innerHTML='<span>'+say('Módosítások elmentve','Changes saved')+'</span><button data-voice-undo>'+say('Visszavonás','Undo')+'</button><small aria-hidden="true">8</small><button data-dismiss aria-label="'+say('Bezárás','Dismiss')+'">×</button>';document.body.append(el);
 const expires=Date.now()+8000,dismiss=()=>{clearInterval(voiceUndoTimer);el.remove()};
 el.querySelector('[data-dismiss]').onclick=dismiss;
 voiceUndoTimer=setInterval(()=>{if(Date.now()>=expires||voiceContext()!==context)dismiss();else el.querySelector('small').textContent=Math.ceil((expires-Date.now())/1000)},200);
 el.querySelector('[data-voice-undo]').onclick=async()=>{
  if(window.household?.busy)return;if(voiceContext()!==context){dismiss();return}
  clearInterval(voiceUndoTimer);el.querySelector('[data-voice-undo]').disabled=true;
  const result=VoiceModel.undo(state,changes),ok=await saveVoiceState(result.next);dismiss();
  if(ok){render();toast(result.skipped?say('A közben módosított tételeket megtartottuk.','Items changed since then were kept.'):say('Visszavonva.','Undone.'))}
  else toast(say('Nem sikerült visszavonni. Ellenőrizd a készletet.','Could not undo. Check your pantry.'));
 };
}
async function openVoiceCommand(mode='voice',initialText='',options={}){
 if(mode==='voice'&&!options.output&&window.AIMode?.isPlus()&&window.MorzsaRealtime){window.MorzsaCompanion?.voice();return}
 if(document.getElementById('voice-dialog')?.open||window.household?.busy)return;
 const say=(hu,en)=>language==='en'?en:hu,context=voiceContext(),launchPage=page;let destination=page==='shopping'?'list':'stock';
 document.getElementById('voice-dialog')?.remove();const q=document.createElement('dialog');q.id='voice-dialog';q.setAttribute('data-no-translate','');document.body.append(q);
 let closed=false,saving=false,recording=false,stream=null,recorder=null,timer=null,chunks=[],bytes=0,discard=false,operations=[],generation=0,conversation=options.history||[];
 const stopTracks=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;clearInterval(timer)};
 const close=()=>{if(!saving)q.close()};
 q.oncancel=e=>{if(saving)e.preventDefault()};
 q.onclose=()=>{closed=true;generation++;discard=true;if(recorder?.state==='recording')recorder.stop();stopTracks();document.removeEventListener('visibilitychange',background);window.removeEventListener('morzsa-pause',pause)};
 const pause=()=>{if(!saving)close()};window.addEventListener('morzsa-pause',pause);const background=()=>{if(document.hidden&&!saving)close()};document.addEventListener('visibilitychange',background);
 const active=()=>{if(voiceContext()!==context){close();return false}return !closed&&q.open};
 function shell(content,title=say('Miben segítsek?','How can I help?')){q.dataset.view='';q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><div class="eyebrow">'+say('MONDD A MORZSÁNAK','TELL MORZSA')+'</div><h2 id="voice-title">'+title+'</h2><p class=assistant-household>'+esc((household?.active?document.getElementById('household-button').textContent.trim():say('Ezen az eszközön','This device')))+' · '+say(destination==='list'?'Lista':'Készlet',destination==='list'?'List':'Pantry')+'</p><div class=voice-body>'+content+'</div>';q.setAttribute('aria-labelledby','voice-title');q.querySelector('.close').onclick=close;}
 function footer(content){const el=document.createElement('div');el.className='voice-footer';el.innerHTML=content;q.append(el)}
 function errorView(error){if(!active())return;shell('<p role="alert">'+esc(voiceError(error))+'</p><button class="primary full" id="voice-retry">'+say('Újra próbálom','Try again')+'</button><button class="small-button full" id="voice-text">'+say('Inkább leírom','Use text instead')+'</button>');q.querySelector('#voice-retry').onclick=()=>{close();openVoiceCommand(mode,initialText)};q.querySelector('#voice-text').onclick=()=>{close();if(launchPage==='shopping'){dashboardGo('shopping');main.querySelector('#add-cart input')?.focus()}else openPantryEntry()};}
 function startView(){
  shell('<div class="assistant-welcome"><img src="assets/illustrations/morzsa-mascot.webp" width="60" height="55" alt=""><p>'+say('Mondd, mi változott, vagy kérdezz bátran.','Tell me what changed, or ask me anything.')+'</p></div><div class="assistant-destinations" role="group" aria-label="'+say('Alapértelmezett cél','Default destination')+'"><button data-assistant-destination="stock">'+say('Készlet','Pantry')+'</button><button data-assistant-destination="list">'+say('Bevásárlólista','Shopping list')+'</button></div><form id="assistant-text-form"><label class="sr-only" for="assistant-text">'+say('Kérdezz, vagy mondd el, mi változott','Ask a question or tell me what changed')+'</label><textarea id="assistant-text" rows="2" maxlength="2000" placeholder="'+say('Elfogyott a tej, írd a listára…','We ran out of milk. Add it to the list…')+'">'+esc(initialText)+'</textarea></form><div class="assistant-starters">'+[['Elfogyott a ','We ran out of ','Elfogyott…','Ran out…'],['Vettem ','I bought ','Vettem…','I bought…'],['Írd a listára: ','Add to the list: ','Listára…','To the list…']].map((x,i)=>'<button data-assistant-starter="'+i+'">'+x[language==='en'?3:2]+'</button>').join('')+'</div><div class="assistant-shortcuts"><button id="assistant-pantry-review">'+say('Mi fogyott el?','What ran out?')+' →</button><button id="assistant-recipes">'+say('Mit főzzünk?','What shall we cook?')+' →</button></div><p class="voice-disclosure">'+say('A Google AI a kérésedet és a jelenlegi háztartás készletét, listáját használja. Ezt a beszélgetést Morzsa nem menti. A változásokat mentés előtt átnézheted.','Google AI uses your message and your current household’s pantry and list. Morzsa does not store this conversation. Review changes before saving.')+'</p>',say('Miben segítsek?','How can I help?'));
  footer('<button class="small-button voice-record" id="voice-record" aria-label="'+say('Kérdezés hanggal','Ask by voice')+'">'+voiceMicIcon+'</button><button class="primary" id="assistant-send">'+say('Küldés','Send')+' ↑</button>');
  q.querySelector('#voice-record').onclick=startRecording;
  const input=q.querySelector('#assistant-text'),send=q.querySelector('#assistant-send'),form=q.querySelector('#assistant-text-form');
  const update=()=>{send.disabled=!input.value.trim();q.querySelectorAll('[data-assistant-destination]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.assistantDestination===destination)));q.querySelector('.assistant-household').textContent=((household?.active?document.getElementById('household-button').textContent.trim():say('Ezen az eszközön','This device')))+' · '+say(destination==='list'?'Lista':'Készlet',destination==='list'?'List':'Pantry')};
  q.querySelectorAll('[data-assistant-destination]').forEach(b=>b.onclick=()=>{destination=b.dataset.assistantDestination;update()});
  const submit=()=>{if(input.value.trim())interpretText(input.value.trim())};input.oninput=update;form.onsubmit=e=>{e.preventDefault();submit()};send.onclick=submit;
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit()}};
  q.querySelectorAll('[data-assistant-starter]').forEach(b=>b.onclick=()=>{input.value=[say('Elfogyott a ','We ran out of '),say('Vettem ','I bought '),say('Írd a listára: ','Add to the list: ')][Number(b.dataset.assistantStarter)];update();input.focus()});
  q.querySelector('#assistant-pantry-review').onclick=()=>{close();window.PantryReview?.openRemoval()};q.querySelector('#assistant-recipes').onclick=()=>{close();dashboardGo('recipes')};update();
  if(mode==='text')input.focus();
 }
 async function startRecording(){
  if(!active())return;if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){errorView(Error('VOICE_UNSUPPORTED'));return;}const token=++generation;shell('<p role=status>'+say('Mikrofon indítása…','Starting microphone…')+'</p>');
  try{
   const acquired=await navigator.mediaDevices.getUserMedia({audio:true});if(!active()||token!==generation){acquired.getTracks().forEach(t=>t.stop());return}stream=acquired;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('VOICE_UNSUPPORTED');
   recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:64000});chunks=[];bytes=0;discard=false;
   recorder.ondataavailable=e=>{if(e.data.size){bytes+=e.data.size;if(bytes>3000000){discard=true;if(recorder.state==='recording')recorder.stop();stopTracks();errorView(Error('VOICE_TOO_LARGE'));return}chunks.push(e.data)}};
   recorder.onerror=()=>{discard=true;if(recorder.state==='recording')recorder.stop();stopTracks();errorView(Error('VOICE_UNAVAILABLE'))};
   recorder.onstop=async()=>{recording=false;stopTracks();if(discard||!active())return;const blob=new Blob(chunks,{type:mime.split(';')[0]});chunks=[];await interpret(blob)};
   shell('<div class="voice-listening">'+voiceMicIcon+'<span id="voice-clock">0 / 30 s</span></div><p class="voice-record-hint">'+say('Kérdezz bátran, vagy mondd el, mi változott otthon.','Ask me anything, or tell me what changed at home.')+'</p><p class="voice-disclosure">'+say('A Google AI a kérésedet, készletedet és listádat használja. Mentés előtt ellenőrizheted. 30 mp-nél automatikusan elküldjük.','Google AI uses your message, pantry and list. Review before saving. Sent automatically at 30 seconds.')+'</p>',say('Hallgatlak…','Listening…'));q.dataset.view='recording';
   footer('<button class="small-button" id="voice-cancel">'+say('Mégsem','Cancel')+'</button><button class="primary" id="voice-send">'+say('Küldés','Send')+' ↑</button>');
   q.querySelector('#voice-send').onclick=()=>{if(recording&&recorder.state==='recording'){q.querySelector('#voice-send').disabled=true;recorder.stop()}};q.querySelector('#voice-cancel').onclick=close;
   recorder.start(250);recording=true;const start=Date.now();timer=setInterval(()=>{const seconds=Math.floor((Date.now()-start)/1000);const clock=q.querySelector('#voice-clock');if(clock)clock.textContent=seconds+' / 30 s';if(seconds>=30&&recorder.state==='recording')recorder.stop()},200);
  }catch(e){stopTracks();if(active())errorView(e)}
 }
 function requestContext(){return {assistant:true,...(options.onOutput?{companion:true}:{}),destination,context:{...(options.cookingRecipe?{cookingRecipe:options.cookingRecipe,...(Number.isInteger(options.cookingStep)?{cookingStep:options.cookingStep}:{})}:{}),uncertain:window.PantryReview?.uncertain()||[],stock:Object.keys(state.stock).filter(n=>state.stock[n]>0).slice(0,1000),cart:state.cart.slice(0,1000).map(i=>({name:i.name,quantity:i.quantity||1,unit:i.unit||productUnit(i.name)}))},history:conversation.slice(-6)}}
 function receive(output){
  if(options.onOutput){close();options.onOutput(output);return}
  operations=VoiceModel.resolve(output,[...catalog,...state.custom],productEnglish,QuickEntry).map(o=>({...o,enabled:true}));
  conversation.push({role:'user',text:output.transcript},{role:'model',text:output.answer||output.clarification||say('Módosításokat javasoltam, még nincsenek mentve.','Changes proposed, not yet saved.')});conversation=conversation.slice(-6);
  if(operations.length)review(output);else answerView(output);
 }
 function answerView(output){
  shell('<div class="assistant-answer" role="status">'+esc(output.answer||output.clarification||say('Nem értettem pontosan. Elmondanád másképp?','I did not quite catch that. Could you rephrase?'))+'</div>'+(output.answer&&output.clarification?'<p class="voice-clarification">'+esc(output.clarification)+'</p>':'')+'<form id="assistant-followup-form"><label for="assistant-followup">'+say('Kérdezz tovább','Ask a follow-up')+'</label><textarea id="assistant-followup" rows="2" maxlength="2000" placeholder="'+say('És valami gyorsabbat?','Something quicker?')+'"></textarea></form>',say('Morzsa válasza','Morzsa’s answer'));
  footer('<button class="small-button" id="assistant-followup-mic" aria-label="'+say('Kérdezés hanggal','Ask by voice')+'">'+voiceMicIcon+'</button><button class="primary" id="assistant-followup-send" disabled>'+say('Küldés','Send')+'</button>');
  const input=q.querySelector('#assistant-followup'),send=q.querySelector('#assistant-followup-send');input.oninput=()=>send.disabled=!input.value.trim();const submit=()=>{if(input.value.trim())interpretText(input.value.trim())};send.onclick=submit;q.querySelector('form').onsubmit=e=>{e.preventDefault();submit()};q.querySelector('#assistant-followup-mic').onclick=startRecording;const links=document.createElement('div');links.className='assistant-shortcuts';links.innerHTML='<button data-assistant-go=pantry>'+say('Készlet →','Pantry →')+'</button><button data-assistant-go=shopping>'+say('Lista →','List →')+'</button><button data-assistant-go=recipes>'+say('Receptek →','Recipes →')+'</button>';q.querySelector('.assistant-answer').after(links);links.querySelectorAll('button').forEach(b=>b.onclick=()=>{close();dashboardGo(b.dataset.assistantGo)});
 }
 async function interpretText(text){
  if(!active())return;shell('<p role="status">'+say('Értelmezem a kérésed…','Interpreting your request…')+'</p>');
  try{const output=await window.household.voiceCommand({text,language,...requestContext()});if(!active())return;receive(output)}catch(e){if(active())errorView(e)}
 }
 async function interpret(blob){
  shell('<p role="status">'+say('Értelmezem a mondatodat…','Interpreting your message…')+'</p>');
  try{
   if(!blob.size)throw Error('VOICE_INVALID_RESPONSE');
   const audio=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)});
   if(!active())return;const output=await window.household.voiceCommand({audio,mimeType:blob.type,language,...requestContext()});
   if(!active())return;receive(output);
  }catch(e){if(active())errorView(e)}
 }
 function review(output){
  shell('<details class="voice-transcript-details"><summary>'+say('Ezt mondtad','Your message')+'</summary><blockquote class="voice-transcript">'+esc(output.transcript)+'</blockquote></details>'+(output.clarification?'<p class="voice-clarification">'+esc(output.clarification)+'</p>':'')+'<div id="voice-operations"></div><p id="voice-feedback" role="status"></p>',say('Így jó lesz?','Does this look right?'));q.dataset.view='review';
  footer('<button class="small-button" id="voice-again">'+say('Új kérés','New request')+'</button><button class="primary" id="voice-apply">'+say('Mentés','Save changes')+'</button>');
  if(output.answer){const answer=document.createElement('div');answer.className='assistant-answer compact';answer.textContent=output.answer;q.querySelector('#voice-operations').before(answer)}
  const container=q.querySelector('#voice-operations');
  const labels={stock_add:say('Készletbe','To pantry'),stock_remove:say('Elfogyott','Used up'),list_set:say('Listára','To list')},expanded=new Set();
  const summary=o=>{const d=VoiceModel.defaults(o,state,productUnit);return labels[o.action]+(o.action==='list_set'?' · '+d.quantity+' '+d.unit:'')};
  const paint=()=>{
   container.innerHTML=operations.map((o,i)=>'<div class="voice-operation"><input type="checkbox" data-enabled="'+i+'" '+(o.enabled?'checked':'')+' aria-label="'+say('Művelet megtartása','Keep change')+' '+(i+1)+'"><details class="voice-operation-edit" data-edit="'+i+'" '+(!o.confirmed||expanded.has(i)?'open':'')+'><summary aria-label="'+say('Szerkesztés: ','Edit: ')+esc(displayName(o.name))+'"><span class="voice-item-name">'+esc(displayName(o.name))+'</span><span class="voice-item-action">'+esc(summary(o))+'</span><span class="voice-edit-mark" aria-hidden="true">⌄</span></summary><div class="voice-operation-fields"><input data-name="'+i+'" value="'+esc(displayName(o.name))+'" maxlength="80" aria-label="'+say('Termék','Product')+' '+(i+1)+'" list="voice-products-'+i+'"><datalist id="voice-products-'+i+'">'+[...new Set([...o.suggestions,...catalog.map(c=>c.name),...state.custom.map(c=>c.name)])].map(n=>'<option value="'+esc(displayName(n))+'"></option>').join('')+'</datalist><select data-action="'+i+'" aria-label="'+say('Művelet','Action')+' '+(i+1)+'">'+Object.entries(labels).map(([id,label])=>'<option value="'+id+'" '+(o.action===id?'selected':'')+'>'+label+'</option>').join('')+'</select>'+(o.action==='list_set'?'<div class="voice-quantity"><input data-quantity="'+i+'" aria-label="'+say('Teljes mennyiség','Total quantity')+'" type="number" min="0.01" max="999" step="any" placeholder="'+say('Meglévő / 1','Current / 1')+'" value="'+(o.quantity??'')+'"><select data-unit="'+i+'" aria-label="'+say('Egység','Unit')+'"><option value="">'+say('Alapértelmezett','Default')+'</option>'+['db','kg','g','l','ml','csomag','doboz','üveg','pohár'].map(u=>'<option '+(o.unit===u?'selected':'')+'>'+u+'</option>').join('')+'</select></div>':'')+(!o.confirmed?'<label class="voice-confirm"><input type="checkbox" data-confirm="'+i+'">'+say('Ezt a pontos nevet használom','Use this exact name')+'</label>':'')+'</div></details></div>').join('');
   container.querySelectorAll('[data-edit]').forEach(e=>e.ontoggle=()=>{if(e.open)expanded.add(Number(e.dataset.edit));else expanded.delete(Number(e.dataset.edit))});
   container.querySelectorAll('[data-enabled]').forEach(e=>e.onchange=()=>{operations[e.dataset.enabled].enabled=e.checked;update()});
   container.querySelectorAll('[data-name]').forEach(e=>e.onchange=()=>{const o=operations[e.dataset.name],matched=QuickEntry.ranked(e.value,[...catalog,...state.custom],productEnglish).find(r=>r.exact);o.name=matched?.item.name||e.value.trim();o.confirmed=!!matched;paint()});
   container.querySelectorAll('[data-action]').forEach(e=>e.onchange=()=>{operations[e.dataset.action].action=e.value;paint()});
   container.querySelectorAll('[data-confirm]').forEach(e=>e.onchange=()=>{operations[e.dataset.confirm].confirmed=e.checked;update()});
   container.querySelectorAll('[data-quantity]').forEach(e=>e.oninput=()=>{operations[e.dataset.quantity].quantity=e.value===''?null:Number(e.value);update()});
   container.querySelectorAll('[data-unit]').forEach(e=>e.onchange=()=>{operations[e.dataset.unit].unit=e.value||null;update()});update();
  };
  function update(){container.querySelectorAll('[data-edit]').forEach(e=>{const o=operations[e.dataset.edit];e.querySelector('.voice-item-action').textContent=summary(o);e.closest('.voice-operation').classList.toggle('excluded',!o.enabled)});const selected=operations.filter(o=>o.enabled).map(o=>VoiceModel.defaults(o,state,productUnit));q.querySelector('#voice-apply').disabled=saving||!selected.length||selected.some(o=>!o.confirmed||o.action==='list_set'&&o.quantity!==null&&o.quantity<1&&!['kg','l'].includes(o.unit))||!VoiceModel.validate({transcript:'',clarification:'',operations:selected})}
  q.querySelector('#voice-again').onclick=options.output?close:startView;if(options.output)q.querySelector('#voice-again').textContent=say('Vissza','Back');
  q.querySelector('#voice-apply').onclick=async()=>{
   if(!active()){errorView(Error('VOICE_CHANGED'));return}if(saving||window.household?.busy)return;if(options.beforeApply&&!options.beforeApply(operations.filter(o=>o.enabled))){q.querySelector('#voice-feedback').textContent=say('Közben változott egy érintett termék. Ellenőrizd, majd mentsd újra.','An affected item changed. Review, then save again.');return}
   const selected=operations.filter(o=>o.enabled);if(!selected.length||selected.some(o=>!o.confirmed))return;
   saving=true;q.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);
   try{const plan=VoiceModel.plan(state,selected,[...catalog,...state.custom],productUnit);const ok=await saveVoiceState(plan.next);if(!ok)throw Error('VOICE_SAVE_FAILED');await window.PantryReview?.confirm(selected.filter(o=>o.action==='stock_add').map(o=>o.name));saving=false;close();homeUndo.length=0;render();showVoiceUndo(plan.changes,context);options.onSaved?.(selected);if(!plan.changes.length)toast(say('Már így szerepel a készletben és a listán.','Your pantry and list already match.'))}
   catch(e){saving=false;q.querySelectorAll('button,input,select').forEach(e=>e.disabled=false);q.querySelector('#voice-feedback').textContent=say('Nem sikerült menteni. A javításaid megmaradtak; ellenőrizd és próbáld újra.','Could not save. Your edits are kept; review and try again.');update()}
  };
  paint();
 }
 if(options.output){shell('');q.showModal();receive(options.output);return}
 shell('<p role="status">'+say('Hangfelismerés ellenőrzése…','Checking voice availability…')+'</p>');q.showModal();
 if(!window.household?.userId()){errorView(Error('VOICE_SIGN_IN_REQUIRED'));const button=q.querySelector('#voice-retry');button.textContent=say('Belépés','Sign in');button.onclick=()=>{close();document.getElementById('household-button').click()};return}
 if(mode==='voice'){await startRecording();return}
 try{const status=await window.household.voiceStatus();if(!active())return;if(!status?.configured)throw Error('VOICE_SETUP_REQUIRED');startView()}catch(e){errorView(Error('VOICE_SETUP_REQUIRED'))}
}
