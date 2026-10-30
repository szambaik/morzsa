const voiceMicIcon='<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
const voiceContext=()=>JSON.stringify([window.household?.userId(),window.household?.active]);
async function saveVoiceState(next){if(window.household?.busy)return false;if(window.household?.active){state=next;return !!await window.household.notify()}return commitState(next)}
function voiceError(error){
 const en=language==='en',messages={
 VOICE_SIGN_IN_REQUIRED:['Morzsa AI-segítségéhez előbb lépj be.','Sign in to use Morzsa’s AI assistant.'],
 VOICE_SETUP_REQUIRED:['A hangfelismerés még nincs bekötve. Addig használd a szöveges felvételt.','Voice is not configured yet. You can use text entry in the meantime.'],
 VOICE_DAILY_LIMIT:['Mára elfogyott az asszisztens kerete. A kézi felvétel továbbra is használható.','The daily assistant limit has been reached. Manual entry is still available.'],
 VOICE_INVALID_RESPONSE:['Nem sikerült egyértelműen értelmezni. Mondd el újra rövidebben.','Could not interpret that clearly. Try a shorter message.'],
 VOICE_UNSUPPORTED:['Ebben a böngészőben nem elérhető a hangfelvétel. Használd a szöveges felvételt.','Recording is not available in this browser. Use text entry.'],
 VOICE_TOO_LARGE:['A felvétel túl nagy. Próbálj rövidebb üzenetet.','Recording is too large. Try a shorter message.'],
 VOICE_CHANGED:['Közben megváltozott a fiók vagy a háztartás. Kezdd újra a felvételt.','Account or household changed. Start a new recording.'],
 NotAllowedError:['Engedélyezd a mikrofont a böngészőben, vagy használd a szöveges felvételt.','Allow microphone access in your browser, or use text entry.'],
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
async function openVoiceCommand(mode='voice'){
 if(document.getElementById('voice-dialog')?.open||window.household?.busy)return;
 const say=(hu,en)=>language==='en'?en:hu,context=voiceContext();
 document.getElementById('voice-dialog')?.remove();const q=document.createElement('dialog');q.id='voice-dialog';q.setAttribute('data-no-translate','');document.body.append(q);
 let closed=false,saving=false,recording=false,stream=null,recorder=null,timer=null,chunks=[],bytes=0,discard=false,operations=[],generation=0,conversation=[];
 const stopTracks=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;clearInterval(timer)};
 const close=()=>{if(!saving)q.close()};
 q.oncancel=e=>{if(saving)e.preventDefault()};
 q.onclose=()=>{closed=true;generation++;discard=true;if(recorder?.state==='recording')recorder.stop();stopTracks();document.removeEventListener('visibilitychange',background)};
 const background=()=>{if(document.hidden&&!saving)close()};document.addEventListener('visibilitychange',background);
 const active=()=>{if(voiceContext()!==context){close();return false}return !closed&&q.open};
 function shell(content,title=say('Miben segítsek?','How can I help?')){q.dataset.view='';q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><div class="eyebrow">'+say('MONDD A MORZSÁNAK','TELL MORZSA')+'</div><h2 id="voice-title">'+title+'</h2><div class=voice-body>'+content+'</div>';q.setAttribute('aria-labelledby','voice-title');q.querySelector('.close').onclick=close;}
 function footer(content){const el=document.createElement('div');el.className='voice-footer';el.innerHTML=content;q.append(el)}
 function errorView(error){if(!active())return;shell('<p role="alert">'+esc(voiceError(error))+'</p><button class="primary full" id="voice-retry">'+say('Újra próbálom','Try again')+'</button><button class="small-button full" id="voice-text">'+say('Inkább leírom','Use text instead')+'</button>');q.querySelector('#voice-retry').onclick=()=>{close();openVoiceCommand()};q.querySelector('#voice-text').onclick=()=>{close();openPantryEntry()};}
 function startView(){
  shell('<p>'+say('„Vettem tejet és tojást. A vaj elfogyott, írd a listára.”','“I bought milk and eggs. We ran out of butter; put it on the list.”')+'</p><button class="voice-record primary full" id="voice-record">'+voiceMicIcon+' '+say('Felvétel indítása','Start recording')+'</button><p class="voice-disclosure">'+say('Legfeljebb 30 másodperc. A Google AI a kérésedet, készletedet, listádat és az itt folytatott beszélgetést használja; a Morzsa nem menti el a beszélgetést. Küldés után ellenőrizheted és javíthatod a változásokat.','Up to 30 seconds. Google AI uses your message, pantry, list and this conversation; Morzsa does not store the conversation. Review and edit the changes after sending.')+'</p>');
  q.querySelector('#voice-record').onclick=startRecording;
  const form=document.createElement('form');form.id='assistant-text-form';form.innerHTML='<label for="assistant-text">'+say('Kérdezz, vagy mondd el, mi változott','Ask a question or tell me what changed')+'</label><textarea id="assistant-text" rows="2" maxlength="2000" placeholder="'+say('Vettem tejet. Elfogyott a vaj, írd a listára.','Bought milk. We ran out of butter; put it on the list.')+'"></textarea><button class="primary full" id="assistant-send" disabled>'+say('Értelmezés','Interpret')+'</button>';q.querySelector('.voice-disclosure').before(form);
  const input=form.querySelector('textarea'),send=form.querySelector('button');input.oninput=()=>send.disabled=!input.value.trim();form.onsubmit=e=>{e.preventDefault();if(input.value.trim())interpretText(input.value.trim())};
  const ideas=document.createElement('button');ideas.className='small-button full';ideas.textContent=say('Mit főzhetnék ezekből?','What can I cook with this?');ideas.onclick=()=>{close();page='recipes';render();window.scrollTo(0,0)};q.querySelector('.voice-body').append(ideas);
  if(mode==='text')input.focus();
 }
 async function startRecording(){
  if(!active())return;if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){errorView(Error('VOICE_UNSUPPORTED'));return;}const token=++generation;shell('<p role=status>'+say('Mikrofon indítása…','Starting microphone…')+'</p>');
  try{
   const acquired=await navigator.mediaDevices.getUserMedia({audio:true});if(!active()||token!==generation){acquired.getTracks().forEach(t=>t.stop());return}stream=acquired;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('VOICE_UNSUPPORTED');
   recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:64000});chunks=[];bytes=0;discard=false;
   recorder.ondataavailable=e=>{if(e.data.size){bytes+=e.data.size;if(bytes>3000000){discard=true;if(recorder.state==='recording')recorder.stop();stopTracks();errorView(Error('VOICE_TOO_LARGE'));return}chunks.push(e.data)}};
   recorder.onerror=()=>{discard=true;stopTracks();errorView(Error('VOICE_UNAVAILABLE'))};
   recorder.onstop=async()=>{recording=false;stopTracks();if(discard||!active())return;const blob=new Blob(chunks,{type:mime.split(';')[0]});chunks=[];await interpret(blob)};
   shell('<div class="voice-listening">'+voiceMicIcon+'<span id="voice-clock">0 / 30 s</span></div><p class="voice-record-hint">'+say('Kérdezz bátran, vagy mondd el, mi változott otthon.','Ask me anything, or tell me what changed at home.')+'</p><p class="voice-disclosure">'+say('A Google AI a kérésedet, készletedet és listádat használja. Mentés előtt ellenőrizheted. 30 mp-nél automatikusan elküldjük.','Google AI uses your message, pantry and list. Review before saving. Sent automatically at 30 seconds.')+'</p>',say('Hallgatlak…','Listening…'));q.dataset.view='recording';
   footer('<button class="small-button" id="voice-cancel">'+say('Mégsem','Cancel')+'</button><button class="primary" id="voice-send">'+say('Küldés','Send')+' ↑</button>');
   q.querySelector('#voice-send').onclick=()=>{if(recording&&recorder.state==='recording'){q.querySelector('#voice-send').disabled=true;recorder.stop()}};q.querySelector('#voice-cancel').onclick=close;
   recorder.start(250);recording=true;const start=Date.now();timer=setInterval(()=>{const seconds=Math.floor((Date.now()-start)/1000);const clock=q.querySelector('#voice-clock');if(clock)clock.textContent=seconds+' / 30 s';if(seconds>=30&&recorder.state==='recording')recorder.stop()},200);
  }catch(e){stopTracks();if(active())errorView(e)}
 }
 function requestContext(){return {assistant:true,destination:page==='shopping'?'list':'stock',context:{stock:Object.keys(state.stock).filter(n=>state.stock[n]>0).slice(0,1000),cart:state.cart.slice(0,1000).map(i=>({name:i.name,quantity:i.quantity||1,unit:i.unit||productUnit(i.name)}))},history:conversation.slice(-6)}}
 function receive(output){
  operations=VoiceModel.resolve(output,[...catalog,...state.custom],productEnglish,QuickEntry).map(o=>({...o,enabled:true}));
  conversation.push({role:'user',text:output.transcript},{role:'model',text:output.answer||output.clarification||say('Módosításokat javasoltam, még nincsenek mentve.','Changes proposed, not yet saved.')});conversation=conversation.slice(-6);
  if(operations.length)review(output);else answerView(output);
 }
 function answerView(output){
  shell('<div class="assistant-answer" role="status">'+esc(output.answer||output.clarification||say('Nem értettem pontosan. Elmondanád másképp?','I did not quite catch that. Could you rephrase?'))+'</div>'+(output.answer&&output.clarification?'<p class="voice-clarification">'+esc(output.clarification)+'</p>':'')+'<form id="assistant-followup-form"><label for="assistant-followup">'+say('Kérdezz tovább','Ask a follow-up')+'</label><textarea id="assistant-followup" rows="2" maxlength="2000" placeholder="'+say('És valami gyorsabbat?','Something quicker?')+'"></textarea></form>',say('Morzsa válasza','Morzsa’s answer'));
  footer('<button class="small-button" id="assistant-followup-mic" aria-label="'+say('Kérdezés hanggal','Ask by voice')+'">'+voiceMicIcon+'</button><button class="primary" id="assistant-followup-send" disabled>'+say('Küldés','Send')+'</button>');
  const input=q.querySelector('#assistant-followup'),send=q.querySelector('#assistant-followup-send');input.oninput=()=>send.disabled=!input.value.trim();const submit=()=>{if(input.value.trim())interpretText(input.value.trim())};send.onclick=submit;q.querySelector('form').onsubmit=e=>{e.preventDefault();submit()};q.querySelector('#assistant-followup-mic').onclick=startRecording;
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
  q.querySelector('#voice-again').onclick=startView;
  q.querySelector('#voice-apply').onclick=async()=>{
   if(!active()){errorView(Error('VOICE_CHANGED'));return}if(saving||window.household?.busy)return;
   const selected=operations.filter(o=>o.enabled);if(!selected.length||selected.some(o=>!o.confirmed))return;
   saving=true;q.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);
   try{const plan=VoiceModel.plan(state,selected,[...catalog,...state.custom],productUnit);const ok=await saveVoiceState(plan.next);if(!ok)throw Error('VOICE_SAVE_FAILED');saving=false;close();homeUndo.length=0;render();showVoiceUndo(plan.changes,context);if(!plan.changes.length)toast(say('Már így szerepel a készletben és a listán.','Your pantry and list already match.'))}
   catch(e){saving=false;q.querySelectorAll('button,input,select').forEach(e=>e.disabled=false);q.querySelector('#voice-feedback').textContent=say('Nem sikerült menteni. A javításaid megmaradtak; ellenőrizd és próbáld újra.','Could not save. Your edits are kept; review and try again.');update()}
  };
  paint();
 }
 shell('<p role="status">'+say('Hangfelismerés ellenőrzése…','Checking voice availability…')+'</p>');q.showModal();
 if(!window.household?.userId()){errorView(Error('VOICE_SIGN_IN_REQUIRED'));const button=q.querySelector('#voice-retry');button.textContent=say('Belépés','Sign in');button.onclick=()=>{close();document.getElementById('household-button').click()};return}
 if(mode==='voice'){await startRecording();return}
 try{const status=await window.household.voiceStatus();if(!active())return;if(!status?.configured)throw Error('VOICE_SETUP_REQUIRED');startView()}catch(e){errorView(Error('VOICE_SETUP_REQUIRED'))}
}
