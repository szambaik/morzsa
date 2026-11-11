// Chat-first shell. AI suggestions are proposals; mutations use existing save paths.
window.MorzsaCompanion=(()=>{
 const M=CompanionModel,say=(hu,en)=>language==='en'?en:hu;
 let context='',book={threads:[]},draft='',busy=false,saving=false,error='',pending=null,serial=0,removedNames=[],deferred={},quietUntil=0;
 const scope=()=>M.key(household?.userId(),household?.active,language),thread=()=>book.threads.find(t=>t.id===book.active);
 const icon=(name)=>({history:'☰',new:'＋',close:'×',arrow:'↑',cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 3h3l3 13h11M6 6h15l-2 7H7"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>',home:houseIcon})[name];
 const safeRead=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
 function sync(){
  const next=scope();if(context===next)return;
  context=next;serial++;busy=false;saving=false;pending=null;error='';draft='';removedNames=[];quietUntil=0;deferred=safeRead(context+':snooze')||{};
  book=M.normalize(safeRead(context),RecipeRoomModel.recipe);
  if(!book.threads.length){
   // Copy legacy conversation without modifying or deleting its original storage.
   const old=RecipeRoomModel.messages(safeRead(RecipeRoomModel.conversationKey(household?.userId(),household?.active,language)));
   const t=M.fresh(crypto.randomUUID());t.messages=old;t.title=old.find(m=>m.role==='user')?.text.slice(0,60)||'';book.threads=[t];book.active=t.id;
  }
  closePanels();
 }
 function persist(){
  book=M.normalize(book,RecipeRoomModel.recipe);
  try{localStorage.setItem(context,JSON.stringify(book));return true}catch{toast(say('Az előzmény nem menthető ezen az eszközön.','History could not be saved on this device.'));return false}
 }
 function append(message){const t=thread();t.messages.push(message);t.updated=Date.now();if(!t.title&&message.role==='user')t.title=message.text.slice(0,60);persist()}
 function fresh(){if(busy||saving)return;sync();if(thread().messages.length){const t=M.fresh(crypto.randomUUID());book.threads.unshift(t);book.active=t.id}pending=null;draft='';error='';persist();closePanels();open()}
 function closePanels(){document.getElementById('companion-history')?.close();document.getElementById('companion-quick')?.close()}
 function open(text=''){page='chat';if(text)draft=text;render();window.scrollTo({top:0,behavior:'instant'});if(text)main.querySelector('#companion-input')?.focus()}
 function onNavigate(){sync();if(page!=='chat')closePanels();viewport()}
 function labels(o){const d=VoiceModel.defaults(o,state,productUnit);return ({stock_add:say('Készletbe','To pantry'),stock_remove:say('Elfogyott','Used up'),list_set:say('Listára','To list')})[o.action]+(o.action==='list_set'?' · '+d.quantity+' '+d.unit:'')}
 function revision(bucket,name){return household?.active?household.rows?.find(r=>r.bucket===bucket&&r.key===name)?.revision:null}
 const fingerprint=ops=>M.fingerprint(state,ops,revision);
 function receive(output,text){
  if(!VoiceModel.validate(output)||output.answer!==undefined&&typeof output.answer!=='string')throw Error('VOICE_INVALID_RESPONSE');
  if(text===undefined)append({role:'user',text:output.transcript,recipes:[]});
  const operations=VoiceModel.resolve(output,[...catalog,...state.custom],productEnglish,QuickEntry);
  append({role:'model',text:output.answer||output.clarification||(operations.length?say('Így módosítanám. Nézd át, mielőtt mentjük.','Here are the proposed changes. Review before saving.'):say('Pontosítanád egy kicsit?','Could you clarify?')),recipes:(output.recipes||[]).map(RecipeRoomModel.recipe).filter(Boolean),...(operations.length?{result:say('Javaslat, nincs mentve.','Proposed, not saved.')}:{})});
  pending=operations.length?{operations,output,stamp:fingerprint(operations),thread:book.active}:null;
 }
 function requestContext(){return {assistant:true,companion:true,destination:'stock',language,context:{stock:Object.keys(state.stock).filter(n=>state.stock[n]>0).slice(0,1000),cart:state.cart.slice(0,1000).map(i=>({name:i.name,quantity:i.quantity||1,unit:i.unit||productUnit(i.name)})),uncertain:(PantryReview?.uncertain()||[]).slice(0,1000)},history:M.history(thread().messages)}}
 async function send(value,retry=false,recipeRequestOnly=false){
  sync();const text=String(value).trim();if(!text||text.length>2000||busy||saving)return;
  if(!household?.userId()){draft=text;renderChat();document.getElementById('household-button').click();return}
  if(pending){toast(say('Előbb mentsd vagy vesd el az előző javaslatot.','Save or dismiss the previous proposal first.'));return}
  const recipeOnly=retry?thread().messages.at(-1)?.provider==='recipes':recipeRequestOnly;const payload=requestContext();if(retry)payload.history=M.history(thread().messages.slice(0,-1));else append({role:'user',text,recipes:[],...(recipeOnly?{provider:'recipes'}:{})});
  const current=context,id=++serial;busy=true;draft='';error='';quietUntil=Date.now()+600000;renderChat();scrollEnd();
  try{let output;if(recipeOnly){const pantry=recipeRequest();const r=await household.recipeIdeas({conversation:true,text,history:payload.history.map(m=>({...m,text:m.text.slice(0,4000)})),names:pantry.names.slice(0,200),uncertain:pantry.uncertain.slice(0,200),language,preferences:{quick:false,mood:'any'}});if(typeof r.answer!=='string'||!Array.isArray(r.recipes)||r.recipes.some(x=>!RecipeRoomModel.recipe(x)))throw Error('VOICE_INVALID_RESPONSE');output={transcript:text,answer:r.answer,recipes:r.recipes,clarification:'',operations:[]}}else output=await household.voiceCommand({...payload,text});if(current!==scope()||id!==serial)return;receive(output,text)}
  catch(e){if(current===scope()&&id===serial)error=voiceError(Error(({AI_DAILY_LIMIT:'VOICE_DAILY_LIMIT',AI_SIGN_IN_REQUIRED:'VOICE_SIGN_IN_REQUIRED',AI_NOT_CONFIGURED:'VOICE_SETUP_REQUIRED',AI_SETUP_REQUIRED:'VOICE_SETUP_REQUIRED'})[e.message]||e.message))}
  finally{if(current===scope()&&id===serial){busy=false;renderChat();scrollEnd()}}
 }
 function voice(){
  sync();if(busy||saving||pending)return;
  const current=context,tid=book.active;
  openVoiceCommand('voice','',{history:M.history(thread().messages),onOutput:output=>{if(current!==scope()||tid!==book.active)return;try{receive(output);quietUntil=Date.now()+600000;open();scrollEnd()}catch(e){toast(voiceError(e))}}});
 }
 function markResult(result){if(!pending)return;const message=thread().messages.at(-1);message.result=result;pending=null;persist()}
 async function apply(){
  const p=pending;if(!p||saving||household?.busy||household?.cartPending)return;
  if(scope()!==context){sync();renderChat();return}
  if(p.stamp!==fingerprint(p.operations)){p.stamp=fingerprint(p.operations);toast(say('Közben változott egy érintett termék. Nézd át újra, majd mentsd.','An affected item changed. Review again, then save.'));renderChat();return}
  if(p.operations.some(o=>!o.confirmed)){editProposal();return}
  saving=true;renderChat();const current=context,undoContext=voiceContext();
  try{
   const plan=VoiceModel.plan(state,p.operations,[...catalog,...state.custom],productUnit);if(!await saveVoiceState(plan.next))throw Error('save');
   if(current!==scope())return;
   await PantryReview?.confirm(p.operations.filter(o=>o.action==='stock_add').map(o=>o.name));
   removed(p.operations.filter(o=>o.action==='stock_remove').map(o=>o.name));
   markResult(say('Elmentve.','Saved.'));showVoiceUndo(plan.changes,undoContext);
  }catch{toast(say('Nem sikerült menteni. A javaslat megmaradt.','Could not save. Your proposal is kept.'))}
  finally{saving=false;if(current===scope())renderChat()}
 }
 function editProposal(){
  if(!pending||saving)return;const current=context,p=pending;let baseline=JSON.parse(JSON.stringify(state)),baseRows=JSON.parse(JSON.stringify(household?.rows||[]));
  openVoiceCommand('text','',{output:p.output,beforeApply:ops=>{if(current!==scope())return false;const stamp=fingerprint(p.operations),changed=stamp!==p.stamp||fingerprint(ops)!==M.fingerprint(baseline,ops,(b,n)=>household?.active?baseRows.find(r=>r.bucket===b&&r.key===n)?.revision:null);if(changed){p.stamp=stamp;baseline=JSON.parse(JSON.stringify(state));baseRows=JSON.parse(JSON.stringify(household?.rows||[]));return false}return true},onSaved:ops=>{if(current!==scope()||pending!==p)return;removed(ops.filter(o=>o.action==='stock_remove').map(o=>o.name));markResult(say('Elmentve.','Saved.'));renderChat()}});
 }
 function recipeCard(r,index){
  const names=r.ingredients.map(i=>QuickEntry.match(i.name,[...catalog,...state.custom],productEnglish)),paths=[...new Set(names.map(n=>productArtwork[n]).filter(Boolean))].slice(0,3);
  return '<article class="companion-recipe"><div class="companion-food">'+(paths.length?paths:['assets/illustrations/morzsa-mascot.webp']).map(p=>'<img src="'+p+'" alt="" width="64" height="64" loading="lazy">').join('')+'</div><small>'+r.minutes+say(' perc · ',' min · ')+names.filter(n=>state.stock[n]>0).length+'/'+names.length+say(' hozzávaló otthon',' ingredients at home')+'</small><h3>'+esc(r.title)+'</h3><p>'+esc(r.summary)+'</p><div class="companion-actions"><button data-recipe="'+index+'">'+say('Recept megnyitása','Open recipe')+' →</button></div></article>';
 }
 let cards=[],refreshQuick=()=>{};
 function proposal(){return pending?'<section class="companion-proposal" aria-label="'+say('Javasolt módosítások','Proposed changes')+'">'+pending.operations.map(o=>'<div><strong>'+esc(displayName(o.name))+'</strong><span>'+esc(labels(o))+'</span></div>').join('')+'<div class="companion-actions"><button class="primary" data-companion-apply '+(saving?'disabled':'')+'>'+say(saving?'Mentés…':'Mentés',saving?'Saving…':'Save changes')+'</button><button data-companion-edit '+(saving?'disabled':'')+'>'+say('Pontosítás','Edit')+'</button><button data-companion-discard '+(saving?'disabled':'')+'>'+say('Mégsem','Dismiss')+'</button></div></section>':''}
 function renderChat(){
  if(page!=='chat')return;sync();document.querySelector('.companion-header-history')?.setAttribute('aria-label',say('Beszélgetéstörténet','Conversation history'));cards=[];const messages=thread().messages;
  const welcome='<div class="companion-welcome"><img src="assets/illustrations/morzsa-mascot.webp" width="76" height="70" alt=""><h1>'+say('Mi főjön ki ma?','What shall we cook up?')+'</h1><p>'+say('Ötleteljünk, főzzünk, vagy mondd el, mi változott otthon.','Let’s cook, find an idea, or catch up on what changed at home.')+'</p><div class="companion-starters"><button data-prompt="sweet">'+say('Valami édeset','Something sweet')+'</button><button data-prompt="quick">'+say('Gyors vacsora','Quick dinner')+'</button><button data-prompt="surprise">'+say('Lepj meg','Surprise me')+'</button></div></div>';
  main.innerHTML='<section class="companion" data-no-translate><div class="companion-heading"><button data-history aria-label="'+say('Beszélgetéstörténet','Conversation history')+'">'+icon('history')+'</button><span>'+esc(thread().title||say('A konyhai társad','Your kitchen companion'))+'</span><button data-new aria-label="'+say('Új beszélgetés','New conversation')+'" '+(busy||saving?'disabled':'')+'>'+icon('new')+'</button></div><div class="companion-messages">'+(!messages.length?welcome:messages.map(m=>'<article class="companion-message '+m.role+'">'+(m.role==='model'?'<div class="companion-speaker"><img src="assets/brands/morzsa.svg" width="20" height="20" alt="">Morzsa</div>':'')+'<p>'+esc(m.text)+'</p>'+(m.recipes||[]).map(r=>{const i=cards.push(r)-1;return recipeCard(r,i)}).join('')+(m.result?'<small class="companion-result">'+esc(m.result)+'</small>':'')+'</article>').join(''))+proposal()+(busy?'<p class="companion-thinking" role="status">'+say('Morzsa gondolkodik…','Morzsa is thinking…')+'</p>':'')+(error?'<div class="companion-error" role="alert"><p>'+esc(error)+'</p><button data-retry>'+say('Újrapróbálom','Try again')+'</button></div>':'')+'<div id="companion-nudge"></div><div id="companion-end"></div></div><div class="companion-compose-wrap"><div class="companion-tools"><button data-quick="shopping">'+icon('cart')+say('Lista','List')+' <small>'+state.cart.filter(i=>!i.done).length+'</small></button><button data-quick="pantry">'+icon('home')+say('Készlet','Pantry')+'</button><button data-full="overview">'+say('Áttekintés','Overview')+'</button></div><form id="companion-form"><textarea id="companion-input" rows="1" maxlength="2000" aria-label="'+say('Üzenet Morzsának','Message Morzsa')+'" placeholder="'+say('Mihez lenne kedved?','What do you have in mind?')+'">'+esc(draft)+'</textarea><button type="button" data-mic aria-label="'+say('Kérdezés hanggal','Ask by voice')+'" '+(busy||saving||pending?'disabled':'')+'>'+voiceMicIcon+'</button><button type="submit" aria-label="'+say('Küldés','Send')+'" '+(busy||saving||pending?'disabled':'')+'>'+icon('arrow')+'</button></form><div class="companion-disclosure">'+(!household?.userId()?'<button data-login>'+say('Belépés az AI-beszélgetéshez','Sign in to chat with AI')+'</button>':'<span>'+say('AI · Google · előzmények ezen az eszközön','AI · Google · history on this device')+'</span>')+'</div></div></section>';
  const input=main.querySelector('#companion-input');input.oninput=()=>{draft=input.value;input.style.height='auto';input.style.height=Math.min(input.scrollHeight,110)+'px'};
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send(input.value)}};
  main.querySelector('#companion-form').onsubmit=e=>{e.preventDefault();send(input.value)};
  main.querySelector('[data-history]').onclick=history;main.querySelector('[data-new]').onclick=fresh;main.querySelector('[data-mic]').onclick=voice;
  main.querySelector('[data-login]')?.addEventListener('click',()=>document.getElementById('household-button').click());
  main.querySelector('[data-retry]')?.addEventListener('click',()=>send(thread().messages.at(-1)?.text||'',true));
  main.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>quick(b.dataset.quick));main.querySelectorAll('[data-full]').forEach(b=>b.onclick=()=>dashboardGo(b.dataset.full));
  main.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>send(({sweet:say('Valami édeset készítenék abból, ami otthon van. Adj egy receptet.','I want something sweet using my pantry. Give me a recipe.'),quick:say('Mi legyen a vacsora? Van rá 25 percem. Adj receptet.','What can I cook in 25 minutes? Give me a recipe.'),surprise:say('Lepj meg egy finom recepttel a készletemből!','Surprise me with a tasty recipe using my pantry!')})[b.dataset.prompt],false,true));
  main.querySelector('[data-companion-apply]')?.addEventListener('click',apply);main.querySelector('[data-companion-edit]')?.addEventListener('click',editProposal);main.querySelector('[data-companion-discard]')?.addEventListener('click',()=>{markResult(say('Elvetve, nem módosítottunk semmit.','Dismissed; nothing was changed.'));renderChat()});
  main.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>window.RecipeRoom?.open(cards[Number(b.dataset.recipe)]));
  updateNudge();viewport();
 }
 function scrollEnd(){requestAnimationFrame(()=>main.querySelector('#companion-end')?.scrollIntoView({block:'end',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}))}
 function panel(id){let q=document.getElementById(id);if(!q){q=document.createElement('dialog');q.id=id;q.setAttribute('data-no-translate','');document.body.append(q)}return q}
 function history(){
  const q=panel('companion-history');q.innerHTML='<div class="companion-panel-head"><h2>'+say('Beszélgetéseid','Your conversations')+'</h2><button data-close aria-label="'+say('Bezárás','Close')+'">×</button></div><p class="companion-caption">'+say('Személyes · ezen az eszközön · jelenlegi háztartás','Private · this device · current household')+'</p><button class="companion-new" data-new '+(busy||saving?'disabled':'')+'>'+say('＋ Új beszélgetés','＋ New conversation')+'</button><div class="companion-history-items">'+book.threads.map((t,i)=>'<button data-thread="'+i+'" '+(busy||saving?'disabled':'')+' aria-current="'+(t.id===book.active)+'"><strong>'+esc(t.title||say('Új beszélgetés','New conversation'))+'</strong><small>'+new Date(t.updated).toLocaleDateString(language==='en'?'en-GB':'hu-HU')+'</small></button>').join('')+'</div><p class="companion-caption">'+say('Legutóbbi 20 beszélgetés.','Your latest 20 conversations.')+'</p>';
  q.querySelector('[data-close]').onclick=()=>q.close();q.querySelector('[data-new]').onclick=fresh;
  q.querySelectorAll('[data-thread]').forEach(b=>b.onclick=()=>{book.active=book.threads[Number(b.dataset.thread)].id;pending=null;draft='';error='';persist();q.close();renderChat()});q.showModal();
  let start=null;q.onpointerdown=e=>{start={x:e.clientX,y:e.clientY}};q.onpointerup=e=>{if(start&&start.x-e.clientX>65&&Math.abs(e.clientY-start.y)<50)q.close();start=null};
 }
 function removed(names){sync();removedNames=[...new Set([...names,...removedNames])].slice(0,10);updateNudge()}
 function nudge(){if(busy||saving||pending)return null;const n=M.suggestion(state,PantryReview?.candidates()||[],removedNames,deferred);return n?.type==='review'&&Date.now()<quietUntil?null:n}
 function updateNudge(){
  if(context!==scope())return;
  const host=main.querySelector('#companion-nudge');if(!host)return;const n=nudge();if(!n){host.innerHTML='';return}
  const name=displayName(n.names[0]),title=n.type==='bought'?say('Megvolt a bevásárlás?','Finished shopping?'):n.type==='restock'?say('Felírjam a listára?','Add it to the list?'):name+say(' · megvan még?',' · still at home?');
  const text=n.type==='bought'?n.names.length+say(' kipipált tételt a készletbe tehetünk.',' checked items can move to your pantry.'):n.type==='restock'?name+say(' elfogyott. Gondoskodjunk az utánpótlásról?',' ran out. Shall we get some more?'):n.unknown?say('Ezt még nem ellenőriztük együtt.','We haven’t checked this together yet.'):say('Egy ideje nem erősítettétek meg.','It has been a while since you checked.');
  host.innerHTML='<aside class="companion-nudge"><div class="companion-speaker"><img src="assets/brands/morzsa.svg" width="18" height="18" alt="">'+say('Egy apróság…','One small thing…')+'</div><strong>'+esc(title)+'</strong><p>'+esc(text)+'</p><div class="companion-actions">'+(n.type==='review'?'<button data-nudge="keep">'+say('Van még','Still here')+'</button><button data-nudge="gone">'+say('Elfogyott','Used up')+'</button>':'<button data-nudge="'+(n.type==='bought'?'bought':'list')+'">'+(n.type==='bought'?say('Elpakoltam','Put away'):say('Listára','Add to list'))+'</button>')+'<button data-nudge="later">'+say('Most nem','Not now')+'</button></div></aside>';
  host.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=async()=>{
   if(context!==scope()||saving||household?.busy||household?.cartPending||nudge()?.id!==n.id)return;
   if(b.dataset.nudge==='later'){deferred[n.id]=Date.now()+86400000;try{localStorage.setItem(context+':snooze',JSON.stringify(Object.fromEntries(Object.entries(deferred).filter(([,v])=>v>Date.now()).slice(-100))))}catch{}updateNudge();return}
   const current=context;host.querySelectorAll('button').forEach(x=>x.disabled=true);
   if(b.dataset.nudge==='keep')await PantryReview.confirm(n.names);
   if(b.dataset.nudge==='gone')await PantryReview.remove(n.names);
   if(b.dataset.nudge==='list')await addToList(n.names[0]);
   if(b.dataset.nudge==='bought'){await completeShopping(false);if(page==='chat')renderChat()}
   if(current===scope())updateNudge();
  });
 }
 async function addToList(name){
  if(state.cart.some(i=>i.name===name))return;
  const next={...state,cart:[...state.cart,{name,quantity:1,unit:productUnit(name),done:false,source:'Morzsa'}]};
  const current=context,undoContext=voiceContext();
  if(household?.busy||household?.cartPending)return;
  const ok=household?.active?household.editCart(next,{onlyIfMissing:true}):commitState(next);
  if(ok&&current===scope()){basketFeedback(name);toast(say('A listára került.','Added to list.'));if(!household?.active)showVoiceUndo([{bucket:'cart',key:name,before:undefined,after:next.cart.at(-1)}],undoContext);renderChat()}
 }
 function quick(destination){
  sync();const q=panel('companion-quick'),current=context;let query='';
  function paint(){
   if(current!==scope()){q.close();return}const isList=destination==='shopping',names=isList?state.cart.map(i=>i.name):Object.keys(state.stock).filter(n=>state.stock[n]>0).sort((a,b)=>compareProducts({name:a},{name:b}));
   const visible=names.filter(n=>!query||QuickEntry.norm(displayName(n)).includes(QuickEntry.norm(query)));const cats=[...new Set(visible.map(productCategory))].sort((a,b)=>categoryPriorityOrder.indexOf(a)-categoryPriorityOrder.indexOf(b));
   q.innerHTML='<div class="companion-panel-head"><h2>'+say(isList?'Bevásárlólista':'Mi van otthon?',isList?'Shopping list':'Your pantry')+'</h2><button data-close aria-label="'+say('Bezárás','Close')+'">×</button></div><div class="companion-panel-tools"><span>'+names.length+say(' termék',' products')+'</span><button data-expand>'+say('Teljes nézet','Full view')+' ↗</button></div><div class="companion-quick-items">'+(visible.length?cats.map(c=>'<section><h3>'+esc(language==='en'?englishText(c):c)+'</h3>'+(isList?'<div>':'<div class="companion-stock-grid">')+visible.filter(n=>productCategory(n)===c).map(n=>{const i=names.indexOf(n),item=state.cart.find(x=>x.name===n);return isList?'<label class="companion-list-row"><input type="checkbox" data-check="'+i+'" '+(item.done?'checked':'')+'><span>'+esc(displayName(n))+'</span><small>'+esc(cartAmount(item))+'</small></label>':'<article class="companion-stock-item"><img src="'+(productArtwork[n]||'assets/icons/oats.webp')+'" alt="" width="40" height="40"><strong>'+esc(displayName(n))+'</strong><small>'+say(item?'A listán is':'Van otthon',item?'Also on list':'At home')+'</small><div><button data-list="'+i+'" '+(item?'disabled':'')+' aria-label="'+esc(displayName(n))+say(' a listára',' to list')+'">'+icon('cart')+'</button><button data-gone="'+i+'">'+say('Elfogyott','Used up')+'</button></div></article>'}).join('')+'</div></section>').join(''):'<p class="companion-caption">'+say(isList?'A listád most üres.':'Most nincs megjelölt termék.',isList?'Your list is empty.':'No products marked at home.')+'</p>')+'</div><button class="companion-quick-add" data-add>＋ '+say(isList?'Felírok valamit':'Hozzáadok valamit',isList?'Add to list':'Add to pantry')+'</button>';
   q.querySelector('[data-close]').onclick=()=>q.close();q.querySelector('[data-expand]').onclick=()=>{q.close();dashboardGo(destination)};
   q.querySelector('[data-add]').onclick=()=>{q.close();if(isList){dashboardGo('shopping');main.querySelector('#add-cart input')?.focus()}else openPantryEntry()};
   q.querySelectorAll('[data-check]').forEach(b=>b.onchange=()=>{const n=names[Number(b.dataset.check)],next={...state,cart:state.cart.map(i=>i.name===n?{...i,done:b.checked}:i)};if(saveShoppingState(next)){updateNudge();renderChat()}else b.checked=!b.checked});
   q.querySelectorAll('[data-list]').forEach(b=>b.onclick=async()=>{await addToList(names[Number(b.dataset.list)]);paint()});
   q.querySelectorAll('[data-gone]').forEach(b=>b.onclick=async()=>{b.disabled=true;await PantryReview.remove([names[Number(b.dataset.gone)]]);paint()});
  }
  refreshQuick=()=>{if(q.open){const y=q.querySelector('.companion-quick-items')?.scrollTop||0;paint();if(q.querySelector('.companion-quick-items'))q.querySelector('.companion-quick-items').scrollTop=y}};paint();q.showModal();
 }
 function viewport(){const v=window.visualViewport,offset=v?Math.max(0,innerHeight-v.height-v.offsetTop):0;document.documentElement.style.setProperty('--companion-keyboard',offset+'px');document.documentElement.classList.toggle('companion-keyboard',page==='chat'&&offset>120)}
 window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);
 window.addEventListener('morzsa-auth-change',()=>{sync();renderChat()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateNudge()});
 document.querySelector('header').insertAdjacentHTML('afterbegin','<button class="companion-header-history" aria-label="Beszélgetéstörténet" data-no-translate>☰</button>');
 document.querySelector('.companion-header-history').onclick=()=>{if(page!=='chat')open();history()};
 sync();queueMicrotask(()=>render());
 return {render:renderChat,open,onNavigate,updateNudge,removed,quick,refreshQuick:()=>refreshQuick(),purchaseSaved:(before,after,ctx)=>showVoiceUndo(M.changes(before,after),ctx),discuss:r=>{sync();append({role:'model',text:say('Erről a receptről beszélgetünk.','Let’s discuss this recipe.'),recipes:[r]});open(say('Mivel helyettesíthetem a ','What could I use instead of '))}};
})();
