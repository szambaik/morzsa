// Chat-first shell. AI suggestions are proposals; mutations use existing save paths.
window.MorzsaCompanion=(()=>{
 const M=CompanionModel,say=(hu,en)=>language==='en'?en:hu;
 let context='',book={threads:[]},draft='',busy=false,saving=false,error='',pending=null,serial=0,removedNames=[],deferred={},quietUntil=0;
 let streamText='',streamVisible='',failedAnswer='',requestController=null,streamFrame=0,streamTime=0,streamCredit=0;
 let composerOrigin='',drafts=new Map(),expandedRecipes=new Set(),expandedDays=new Set(),recipeDetails=null,showPast=false,renderedDay='';
 const isCooking=()=>thread()?.kind==='recipe',mainThread=()=>{const active=thread();return (active?.kind!=='recipe'&&!active?.archivedAt?active:null)||book.threads.find(t=>t.id===active?.parentId&&!t.archivedAt&&t.kind!=='recipe')||M.historyGroups(book).recent[0]||book.threads.find(t=>t.kind==='main')};
 function resetStream(){cancelAnimationFrame(streamFrame);streamFrame=0;streamText='';streamVisible='';streamTime=0;streamCredit=0}
 function paintStream(){
  if(streamFrame)return;
  const tick=now=>{
   streamFrame=0;const el=main.querySelector('[data-stream-answer]');if(!el)return;
   if(!streamText.startsWith(streamVisible)){streamVisible='';streamCredit=0}
   const delta=streamTime?Math.min(100,Math.max(0,now-streamTime)):16;streamTime=now;
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   streamCredit+=delta/1000*Math.max(180,(streamText.length-streamVisible.length)/6);
   let count=reduced?streamText.length:Math.min(streamText.length,streamVisible.length+Math.floor(streamCredit));
   // Keep emoji code points intact while revealing a streamed prefix.
   if(count<streamText.length&&/[\uD800-\uDBFF]/.test(streamText[count-1]||''))count--;
   streamCredit=Math.max(0,streamCredit-(count-streamVisible.length));
   const follow=scrollY+innerHeight>=document.documentElement.scrollHeight-100;
   streamVisible=streamText.slice(0,count);el.textContent=streamVisible;main.querySelector('.companion-thinking')?.toggleAttribute('hidden',!!streamVisible);
   if(follow)window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
   if(streamVisible.length<streamText.length)streamFrame=requestAnimationFrame(tick);
  };streamFrame=requestAnimationFrame(tick);
 }
 let attachment=null,retryAttachment=null,preparing=false,photoSerial=0;
 const scope=()=>M.workspaceKey(household?.userId(),household?.active,language),thread=()=>book.threads.find(t=>t.id===book.active);
 const ui=name=>'<img class="workspace-icon" src="assets/ui/'+name+'.svg" alt="" width="22" height="22">';
 const icon=name=>ui(({history:'menu',new:'plus',close:'x',arrow:'arrow-up',cart:'shopping-cart',home:'house',overview:'layout-grid'})[name]);
 // Presentation only: full answers are saved immediately; old chats never replay.
 let mentionIndex=null,mentionKey='';
 function ingredientText(text){
  const key=JSON.stringify(state.custom.map(i=>i.name));if(!mentionIndex||key!==mentionKey){mentionKey=key;mentionIndex=IngredientMentions.build([...catalog,...state.custom],productEnglish)}
  return IngredientMentions.split(text,mentionIndex).map(part=>{
   if(!part.name)return esc(part.text);const availability=RecipeRoomModel.ingredientStatus(state.stock,part.name,window.PantryReview?.uncertain()||[]),home=['home','low'].includes(availability),listed=state.cart.some(i=>i.name===part.name),status=(availability==='unknown'?say('Ellenőrizd, megvan-e','Check availability'):pantryStateLabel(availability))+(listed?say(' · A listán is',' · On the list'):'');
   return '<button type="button" class="ingredient-mention '+(availability==='unknown'?'uncertain':home?'at-home':'not-home')+'" data-mention="'+esc(part.name)+'" aria-label="'+esc(part.text+' · '+status)+'" title="'+esc(status)+'"><img src="'+(productArtwork[part.name]||'assets/icons/oats.webp')+'" alt="" width="18" height="18" loading="lazy">'+esc(part.text)+(listed?'<span class="mention-listed" aria-hidden="true">'+icon('cart')+'</span>':'')+'</button>';
  }).join('');
 }
 let reveal=null,revealFrame=0;
 function stopReveal(){cancelAnimationFrame(revealFrame);revealFrame=0;const el=main.querySelector('[data-answer-reveal]');if(el&&reveal)el.closest('p').outerHTML=ChatFormat.render(reveal.text,ingredientText);el?.classList.remove('is-revealing');reveal=null}
 function startReveal(shown=''){
  stopReveal();if(page!=='chat'||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const text=thread().messages.at(-1).text;
  if(shown===text)return;
  const parts=Array.from(text),initialCount=text.startsWith(shown)?Array.from(shown).length:0,length=shown.length;
  reveal={context,thread:book.active,text,index:thread().messages.length-1,parts,count:initialCount,initialCount,start:performance.now(),duration:Math.min(6000,Math.max(600,(text.length-length)*6))};
 }
 function answerText(m,i){
  if(!reveal||m.role!=='model'||i!==reveal.index||book.active!==reveal.thread)return ChatFormat.render(m.text,ingredientText);
  return '<p><span class="sr-only">'+esc(m.text)+'</span><span data-answer-reveal aria-hidden="true" class="is-revealing">'+esc(reveal.parts.slice(0,reveal.count).join(''))+'</span></p>';
 }
 function animateAnswer(){
  cancelAnimationFrame(revealFrame);if(!reveal)return;
  const tick=now=>{
   if(!reveal)return;
   if(page!=='chat'||context!==reveal.context||book.active!==reveal.thread||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches){stopReveal();return}
   const el=main.querySelector('[data-answer-reveal]');if(!el){stopReveal();return}
   const count=Math.min(reveal.parts.length,Math.max(1,reveal.initialCount+Math.ceil((now-reveal.start)/reveal.duration*(reveal.parts.length-reveal.initialCount))));
   if(count!==reveal.count){const follow=scrollY+innerHeight>=document.documentElement.scrollHeight-90;reveal.count=count;el.textContent=reveal.parts.slice(0,count).join('');if(follow&&!document.querySelector('dialog[open]'))window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})}
   if(count>=reveal.parts.length){stopReveal();return}revealFrame=requestAnimationFrame(tick);
  };revealFrame=requestAnimationFrame(tick);
 }
 const safeRead=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
 function sync(){
  const next=scope();if(context===next)return;
  stopReveal();requestController?.abort();requestController=null;resetStream();failedAnswer='';attachment=null;retryAttachment=null;preparing=false;photoSerial++;context=next;serial++;busy=false;saving=false;pending=null;error='';draft='';removedNames=[];quietUntil=0;deferred=safeRead(context+':snooze')||{};
  const legacyKey=M.key(household?.userId(),household?.active,language);
  book=M.normalize(safeRead(context)||safeRead(M.dailyWorkspaceKey(household?.userId(),household?.active,language))||safeRead(M.previousWorkspaceKey(household?.userId(),household?.active,language))||safeRead(legacyKey),RecipeRoomModel.recipe,61);
  if(!book.threads.length){
   // Copy legacy conversation without modifying or deleting its original storage.
   const old=RecipeRoomModel.messages(safeRead(RecipeRoomModel.conversationKey(household?.userId(),household?.active,language)));
   if(old.length){const t=M.fresh(crypto.randomUUID());t.messages=old;t.title=old.find(m=>m.role==='user')?.text.slice(0,60)||'';book.threads=[t];book.active=t.id;}
  }
  book=M.workspace(book,RecipeRoomModel.recipe);drafts=new Map();expandedRecipes=new Set();expandedDays=new Set();showPast=false;persist();
  closePanels();
 }
 function persist(){
  book=M.workspace(book,RecipeRoomModel.recipe);
  try{localStorage.setItem(context,JSON.stringify(book));return true}catch{toast(say('Az előzmény nem menthető ezen az eszközön.','History could not be saved on this device.'));return false}
 }
 function append(message){const t=thread();t.updated=Date.now();t.messages.push({...message,createdAt:t.updated});if(!t.title&&message.role==='user')t.title=message.text.slice(0,60);persist()}
 function canSwitch(){if(busy||saving||pending||preparing){toast(say('Előbb fejezd be a választ vagy kezeld a javaslatot.','Finish the response or review the proposal first.'));return false}return true}
 function selectThread(id){
  sync();if(id===book.active){closePanels();open();return true}if(!canSwitch()||!book.threads.some(t=>t.id===id))return false;
  drafts.set(book.active,{text:draft,attachment,retryAttachment});stopReveal();photoSerial++;book.active=id;expandedRecipes=new Set();recipeDetails=null;const saved=drafts.get(id);draft=saved?.text||'';attachment=saved?.attachment||null;retryAttachment=saved?.retryAttachment||null;error='';failedAnswer='';persist();closePanels();open();return true;
 }
 function goMain(text='',origin=''){composerOrigin=origin;sync();if((busy||saving||pending||preparing)&&page!=='chat')open();if(selectThread(mainThread().id)&&text){draft=text;renderChat();main.querySelector('#companion-input')?.focus()}}
 function ask(text){sync();if(!canSwitch())return false;if(!selectThread(mainThread().id))return false;send(text);return true}
 function askVoice(){sync();if(!canSwitch())return false;if(!selectThread(mainThread().id))return false;voice();return true}
 function newChat(){
  sync();if(!canSwitch())return;
  if(thread()?.kind!=='recipe'&&!thread()?.archivedAt&&!thread()?.messages.length){closePanels();open();main.querySelector('#companion-input')?.focus();return}
  const previous=book;let next;
  try{next=M.startChat(book,crypto.randomUUID(),RecipeRoomModel.recipe)}catch{toast(say('Az előzmények megteltek; folytass egy meglévő beszélgetést.','History is full; continue an existing conversation.'));return}
  drafts.set(book.active,{text:draft,attachment,retryAttachment});book=next;
  if(!persist()){book=previous;return}draft='';attachment=null;retryAttachment=null;photoSerial++;expandedRecipes.clear();expandedDays.clear();showPast=false;error='';failedAnswer='';stopReveal();closePanels();open();main.querySelector('#companion-input')?.focus();
 }
 function archiveCurrent(){
  if(!canSwitch()||isCooking())return;const previous=book,t=thread(),restoring=!!t.archivedAt;
  book=M.archiveThread(book,t.id,RecipeRoomModel.recipe,!restoring);
  if(!persist()){book=previous;return}closePanels();renderChat();toast(say(restoring?'Visszakerült a beszélgetésekhez.':'Archiválva. Az előzményekben megmarad.',restoring?'Returned to conversations.':'Archived. It remains in history.'));
 }
 function discuss(r){
  sync();if(!canSwitch())return false;let next;
  try{next=M.startRecipe(book,r,crypto.randomUUID(),RecipeRoomModel.recipe)}catch{toast(say('Most nem nyitható új receptbeszélgetés.','Cannot open another recipe conversation right now.'));return false}
  drafts.set(book.active,{text:draft,attachment,retryAttachment});book=next;expandedRecipes=new Set();recipeDetails=null;const saved=drafts.get(book.active);draft=saved?.text||'';attachment=saved?.attachment||null;retryAttachment=saved?.retryAttachment||null;photoSerial++;stopReveal();error='';failedAnswer='';persist();window.KitchenIntelligence?.recordRecipe('recipe_started',thread().recipe.title,thread().id);closePanels();open();return true;
 }
 function finishCooking(){
  if(!isCooking()||!canSwitch())return;const t=thread();if(t.status==='completed')return;
  book=M.finishRecipe(book,t.id,RecipeRoomModel.recipe,say('Lezárt főzés: ','Cooking session finished: '));persist();window.KitchenIntelligence?.recordRecipe('recipe_completed',t.recipe.title,t.id);goMain();
 }
 function closePanels(){document.getElementById('companion-history')?.close();document.getElementById('companion-quick')?.close();main.querySelector('.ingredient-inline-actions')?.remove()}
 function open(text=''){page='chat';if(text)draft=text;render();window.scrollTo({top:0,behavior:'instant'});if(text)main.querySelector('#companion-input')?.focus()}
 function onNavigate(){sync();if(page!=='chat'){stopReveal();closePanels()}renderHistoryRail();viewport();refreshCookingResume()}
 function labels(o){const d=VoiceModel.defaults(o,state,productUnit);return ({stock_add:say('Készletbe','To pantry'),stock_remove:say('Elfogyott','Used up'),list_set:say('Listára','To list')})[o.action]+(o.action==='list_set'?' · '+d.quantity+' '+d.unit:'')}
 function revision(bucket,name){return household?.active?household.rows?.find(r=>r.bucket===bucket&&r.key===name)?.revision:null}
 const fingerprint=ops=>M.fingerprint(state,ops,revision);
 function receive(output,text,shown=''){
  if(!VoiceModel.validate(output)||output.answer!==undefined&&typeof output.answer!=='string')throw Error('VOICE_INVALID_RESPONSE');
  if(text===undefined)append({role:'user',text:output.transcript,recipes:[]});
  const operations=VoiceModel.resolve(output,[...catalog,...state.custom],productEnglish,QuickEntry);
  append({role:'model',text:output.answer||output.clarification||(operations.length?say('Így módosítanám. Nézd át, mielőtt mentjük.','Here are the proposed changes. Review before saving.'):say('Pontosítanád egy kicsit?','Could you clarify?')),recipes:(output.recipes||[]).map(RecipeRoomModel.recipe).filter(Boolean),...(operations.length?{result:say('Javaslat, nincs mentve.','Proposed, not saved.')}:output.clarification?{result:say('Pontosítás szükséges.','Clarification needed.')}:{})});
  window.RecipeImages?.enqueue((output.recipes||[]).map(RecipeRoomModel.recipe).filter(Boolean));
  pending=operations.length?{operations,output,stamp:fingerprint(operations),thread:book.active}:null;startReveal(shown);
 }
 function requestContext(){return {assistant:true,companion:true,destination:'stock',language,context:{...(window.KitchenIntelligence?.context(book)||{}),...(isCooking()?{cookingRecipe:thread().recipe,cookingStep:thread().cookingStep||0}:{}),stock:Object.keys(state.stock).filter(n=>state.stock[n]>0).slice(0,1000),cart:state.cart.slice(0,1000).map(i=>({name:i.name,quantity:i.quantity||1,unit:i.unit||productUnit(i.name)})),uncertain:(PantryReview?.uncertain()||[]).slice(0,1000)},history:M.history(M.currentMessages(thread()),12)}}
 async function send(value,retry=false,recipeRequestOnly=false){
  sync();const selected=retry?retryAttachment:attachment;const text=String(value).trim()||(selected?say('Mit látsz a képen? Miben segíthet a főzésnél?','What can you see in this photo? How could I use it for cooking?'):'');if(!text||text.length>2000||busy||saving||preparing)return;
  if(!household?.userId()){draft=text;renderChat();document.getElementById('household-button').click();return}
  if(pending){toast(say('Előbb mentsd vagy vesd el az előző javaslatot.','Save or dismiss the previous proposal first.'));return}
  stopReveal();const recipeOnly=!household.voiceCommandStream&&!selected&&(retry?thread().messages.at(-1)?.provider==='recipes':recipeRequestOnly);const payload=requestContext();if(retry)payload.history=M.history(M.currentMessages(thread()).slice(0,-1),12);else append({role:'user',text,recipes:[],...(selected?{photo:selected.photo}:{}),...(recipeOnly?{provider:'recipes'}:{})});
  const current=context,id=++serial;requestController=new AbortController();const controller=requestController;resetStream();failedAnswer='';busy=true;retryAttachment=selected;attachment=null;draft='';error='';quietUntil=Date.now()+600000;renderChat();scrollEnd();
  try{if(selected){const status=await household.voiceStatus();if(!status.supportsImages)throw Error('PHOTO_SETUP');if(current!==scope()||id!==serial)return}let output;if(household.voiceCommandStream){output=await household.voiceCommandStream({...payload,text,...(selected?{image:selected.image}:{})},partial=>{if(current===scope()&&id===serial){streamText=partial;paintStream()}},controller.signal)}else if(recipeOnly){const pantry=recipeRequest();const r=await household.recipeIdeas({conversation:true,text,history:payload.history.map(m=>({...m,text:m.text.slice(0,4000)})),names:pantry.names.slice(0,200),uncertain:pantry.uncertain.slice(0,200),language,preferences:{quick:false,mood:'any'}});if(typeof r.answer!=='string'||!Array.isArray(r.recipes)||r.recipes.some(x=>!RecipeRoomModel.recipe(x)))throw Error('VOICE_INVALID_RESPONSE');output={transcript:text,answer:r.answer,recipes:r.recipes,clarification:'',operations:[]}}else output=await household.voiceCommand({...payload,text,...(selected?{image:selected.image}:{})});if(current!==scope()||id!==serial)return;if(controller.signal.aborted)throw Error('ABORTED');receive(output,text,streamVisible);resetStream();retryAttachment=null}
  catch(e){if(current===scope()&&id===serial){failedAnswer=streamVisible;error=controller.signal.aborted?say('Megállítottad a választ. Újrapróbálhatod vagy írhatsz mást.','Response stopped. Retry or send a new message.'):e.message==='PHOTO_SETUP'?say('A képfelismeréshez még frissíteni kell a Morzsa AI-szolgáltatását. A fotót megőriztem az újrapróbáláshoz.','Morzsa’s AI service needs an update for photos. Your photo is kept for retry.'):voiceError(Error(({AI_DAILY_LIMIT:'VOICE_DAILY_LIMIT',AI_SIGN_IN_REQUIRED:'VOICE_SIGN_IN_REQUIRED',AI_NOT_CONFIGURED:'VOICE_SETUP_REQUIRED',AI_SETUP_REQUIRED:'VOICE_SETUP_REQUIRED'})[e.message]||e.message))}}
  finally{if(current===scope()&&id===serial){busy=false;resetStream();requestController=null;renderChat();scrollEnd()}}
 }
 function voice(){
  sync();if(busy||saving||pending)return;
  const current=context,tid=book.active;
  openVoiceCommand('voice','',{history:M.history(M.currentMessages(thread())),...(isCooking()?{cookingRecipe:thread().recipe,cookingStep:thread().cookingStep||0}:{}),onOutput:output=>{if(current!==scope()||tid!==book.active)return;try{receive(output);quietUntil=Date.now()+600000;open();scrollEnd()}catch(e){toast(voiceError(e))}}});
 }
 function markResult(result,operations=[]){if(!pending)return;const message=thread().messages.at(-1);message.result=(result+(operations.length?' '+operations.slice(0,4).map(o=>displayName(o.name)+' · '+labels(o)).join('; ')+(operations.length>4?say(' és további ',' and ')+(operations.length-4)+say(' módosítás.',' more changes.'):''):'' )).slice(0,500);pending=null;persist()}
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
   markResult(plan.changes.length?say('Elmentve.','Saved.'):say('Már így szerepel.','Already up to date.'),p.operations.filter(o=>plan.changes.some(c=>c.key===o.name)));showVoiceUndo(plan.changes,undoContext);
  }catch{toast(say('Nem sikerült menteni. A javaslat megmaradt.','Could not save. Your proposal is kept.'))}
  finally{saving=false;if(current===scope())renderChat()}
 }
 function editProposal(){
  if(!pending||saving)return;const current=context,p=pending;let baseline=JSON.parse(JSON.stringify(state)),baseRows=JSON.parse(JSON.stringify(household?.rows||[]));
  openVoiceCommand('text','',{output:p.output,beforeApply:ops=>{if(current!==scope())return false;const stamp=fingerprint(p.operations),changed=stamp!==p.stamp||fingerprint(ops)!==M.fingerprint(baseline,ops,(b,n)=>household?.active?baseRows.find(r=>r.bucket===b&&r.key===n)?.revision:null);if(changed){p.stamp=stamp;baseline=JSON.parse(JSON.stringify(state));baseRows=JSON.parse(JSON.stringify(household?.rows||[]));return false}return true},onSaved:ops=>{if(current!==scope()||pending!==p)return;removed(ops.filter(o=>o.action==='stock_remove').map(o=>o.name));markResult(say('Elmentve.','Saved.'),ops);renderChat()}});
 }
 function recipeCard(r,index){
  const names=r.ingredients.map(i=>QuickEntry.match(i.name,[...catalog,...state.custom],productEnglish)),paths=[...new Set(names.map(n=>productArtwork[n]).filter(Boolean))].slice(0,3);
  return '<article class="companion-recipe"><span class="ai-content-label">'+say('Receptajánlás','Recipe recommendation')+'</span><div data-generated-recipe="'+index+'"></div>'+'<small>'+r.minutes+say(' perc · ',' min · ')+(names.every(n=>state.stock[n]>0)?say('Minden otthon jelölve','All marked at home'):names.filter(n=>!(state.stock[n]>0)).length+say(' hozzávaló hiányzik',' ingredients not marked at home'))+'</small><h3>'+esc(r.title)+'</h3><p>'+esc(r.summary)+'</p><div class="companion-actions"><button class="recipe-chat-cook" data-cook="'+index+'">'+say('Főzzünk együtt','Cook together')+ui('arrow-right')+'</button><button class="recipe-chat-icon" data-recipe="'+index+'" aria-label="'+say('Hozzávalók és recept','Ingredients & recipe')+'">'+ui('sliders-horizontal')+'</button><button class="recipe-chat-icon" data-recipe-favourite="'+index+'" aria-pressed="'+!!window.RecipeRoom?.isFavourite(r)+'" aria-label="'+esc(say('Kedvenc: ','Favourite: ')+r.title)+'">'+ui('heart')+'</button></div>'+(expandedRecipes.has(RecipeShopping.key(r))?'<div class="inline-recipe" data-inline-recipe="'+index+'"></div>':'')+'</article>';
 }
 let cards=[],refreshQuick=()=>{};
 function proposal(){return pending?'<section class="companion-proposal" aria-label="'+say('Javasolt módosítások','Proposed changes')+'"><div class="ai-content-label">'+say('Javaslat · még nincs mentve','Proposal · not saved yet')+'</div>'+pending.operations.map(o=>'<div><strong>'+esc(displayName(o.name))+'</strong><span>'+esc(labels(o))+'</span></div>').join('')+'<div class="companion-actions"><button class="primary" data-companion-apply '+(saving?'disabled':'')+'>'+say(saving?'Mentés…':'Mentés',saving?'Saving…':'Save changes')+'</button><button data-companion-edit '+(saving?'disabled':'')+'>'+say('Pontosítás','Edit')+'</button><button data-companion-discard '+(saving?'disabled':'')+'>'+say('Mégsem','Dismiss')+'</button></div></section>':''}
 function dayLabel(group){
  if(group.key==='today')return say('Ma','Today');
  if(group.day==='undated')return say('Korábbi beszélgetés','Earlier conversation');
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  if(group.day===M.dayKey(Date.now()))return say('Ma · archivált','Today · archived');
  if(group.day===M.dayKey(yesterday.getTime()))return say('Tegnap','Yesterday');
  return new Date(group.day+'T12:00:00').toLocaleDateString(language==='en'?'en-GB':'hu-HU',{year:'numeric',month:'short',day:'numeric'});
 }
 function messageMarkup(m,i){return '<article class="companion-message '+m.role+'">'+(m.role==='model'?'<div class="companion-speaker"><img src="assets/brands/morzsa.svg" width="20" height="20" alt="">Morzsa</div>':'')+(m.photo?'<img class="companion-user-photo" src="'+m.photo+'" alt="'+say('Beküldött fotó','Submitted photo')+'" width="180" height="140">':'')+answerText(m,i)+(m.recipes||[]).map(r=>{const i=cards.push(r)-1;return recipeCard(r,i)}).join('')+(m.result?'<small class="companion-result '+(m.result.startsWith('Elmentve.')||m.result.startsWith('Saved.')?'action-receipt':'')+'">'+esc(m.result)+'</small>':'')+'</article>'}
 function renderMessages(messages,welcome){
  if(thread().kind!=='main')return messages.length?messages.map(messageMarkup).join(''):welcome;
  const groups=M.dayGroups(messages),past=groups.filter(g=>!g.current),today=groups.find(g=>g.current);
  return (past.length?'<details class="companion-past" data-past '+(showPast?'open':'')+'><summary>'+say('Korábbi beszélgetések','Earlier conversations')+'<small>'+past.length+say(' előzmény',' entries')+'</small></summary>'+past.map(g=>'<details class="companion-day" data-day="'+g.key+'" '+(expandedDays.has(g.key)?'open':'')+'><summary><span>'+esc(dayLabel(g))+'</span><small>'+g.items.length+say(' üzenet',' messages')+'</small></summary>'+(expandedDays.has(g.key)?'<div class="companion-day-content">'+g.items.map(({message,index})=>messageMarkup(message,index)).join('')+'</div>':'')+'</details>').join('')+'<p class="companion-caption">'+say('Az előzményeket itt visszanézheted; Morzsa a mai beszélgetést folytatja.','Revisit earlier messages here; Morzsa continues today’s conversation.')+'</p></details>':'')+'<div class="companion-day-divider">'+say('Ma','Today')+'</div>'+(today?today.items.map(({message,index})=>messageMarkup(message,index)).join(''):welcome);
 }
 const cookingStep=()=>thread()?.cookingStep||0;
 const kitchenBowl='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 11h18c0 6-4 9-9 9s-9-3-9-9ZM7 20h10M7 3v4m5-5v5m5-4v4"/></svg>';
 function cookingHeader(){
  if(!isCooking())return '';
  return '<section class="cooking-hero"><div id="cooking-cover" aria-label="'+esc(thread().recipe.title)+'"></div><div class="companion-cooking-focus"><div><small>'+say(thread().status==='completed'?'Lezárt főzés':'Főzzünk együtt',thread().status==='completed'?'Finished cooking':'Let’s cook together')+' · '+thread().recipe.minutes+say(' perc',' min')+'</small><h1>'+esc(thread().title)+'</h1></div>'+(thread().status==='active'?'<button data-finish-cooking>'+say('Befejezem','Finish cooking')+'</button>':'<button data-cook-again>'+say('Újra megfőzöm','Cook again')+'</button>')+'</div></section>';
 }
 function cookingGuide(){
  if(!isCooking())return '';const r=thread().recipe,step=cookingStep(),done=thread().completedSteps||[],details=recipeDetails??matchMedia('(min-width:1000px)').matches,disabled=busy||saving||pending||preparing;
  const outline='<details class="cooking-outline"><summary>'+say('A recept lépései','Recipe steps')+'<small>'+done.length+'/'+r.steps.length+say(' elkészült',' complete')+'</small></summary><ol>'+r.steps.map((_,i)=>'<li><button data-jump-step="'+i+'" aria-current="'+(i===step?'step':'false')+'" '+(disabled?'disabled':'')+'><span aria-hidden="true">'+(done.includes(i)?'✓':i+1)+'</span>'+esc(RecipeRoomModel.stepTitle(r,i))+'</button></li>').join('')+'</ol></details>';
  return '<section class="cooking-guide" aria-label="'+say('A teljes recept','Complete recipe')+'"><p class="cooking-summary">'+esc(r.summary)+'</p><div class="cooking-ingredients-heading"><button data-current-recipe aria-expanded="'+details+'" aria-controls="cooking-ingredients">'+kitchenBowl+say('Hozzávalók','Ingredients')+'<small>'+r.ingredients.length+'</small><span aria-hidden="true">'+(details?'−':'+')+'</span></button></div>'+(details?'<div class="inline-recipe" id="cooking-ingredients"></div>':'')+'<div class="cooking-method-heading"><h2>'+say((step+1)+'. lépés / '+r.steps.length,'Step '+(step+1)+' of '+r.steps.length)+'</h2><small>'+done.length+'/'+r.steps.length+say(' elkészült',' complete')+'</small></div><div class="cooking-flow"><ol class="cooking-steps">'+r.steps.map((text,i)=>'<li class="cooking-step '+(step===i?'is-current':'')+'" id="cooking-step-'+i+'" data-cooking-step="'+i+'" tabindex="-1" '+(step!==i?'hidden':'aria-current="step"')+'><div><h3>'+esc(RecipeRoomModel.stepTitle(r,i))+'</h3><p>'+ingredientText(text)+'</p><div data-cooking-image="'+i+'"></div>'+(i===step&&thread().status==='active'?'<button class="cooking-complete" data-complete-step '+(disabled?'disabled':'')+'>'+say(i===r.steps.length-1?'Elkészült a fogás ✓':'Elkészült, tovább →',i===r.steps.length-1?'Dish finished ✓':'Done, next →')+'</button>':'')+(done.includes(i)?'<small class="cooking-step-completed">'+say('✓ Ezt már késznek jelölted','✓ You marked this step complete')+'</small>':'')+'</div></li>').join('')+'</ol>'+outline+'</div></section>';
 }
 function cookingDock(){
  if(!isCooking())return '';const step=cookingStep(),count=thread().recipe.steps.length,disabled=busy||saving||pending||preparing;
  return '<div class="cooking-dock" role="group" aria-label="'+say('Főzési gyorsműveletek','Cooking shortcuts')+'"><button class="cooking-ingredients-shortcut" data-cooking-ingredients>'+kitchenBowl+say('Hozzávalók','Ingredients')+'</button><button data-step-prev aria-label="'+say('Előző lépés','Previous step')+'" '+(disabled||step===0?'disabled':'')+'>‹</button><label class="cooking-step-picker"><span class="sr-only">'+say('Aktuális főzési lépés','Current cooking step')+'</span><select data-step-select '+(disabled?'disabled':'')+'>'+thread().recipe.steps.map((_,i)=>'<option value="'+i+'" '+(step===i?'selected':'')+'>'+esc((i+1)+'. '+RecipeRoomModel.stepTitle(thread().recipe,i))+'</option>').join('')+'</select></label><button data-step-next aria-label="'+say('Következő lépés','Next step')+'" '+(disabled||step===count-1?'disabled':'')+'>›</button></div>';
 }
 function showCookingIngredients(){
  sync();if(!isCooking())return;recipeDetails=true;closePanels();if(page!=='chat')open();else renderChat();
  main.querySelector('#cooking-ingredients')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 function mountCookingImages(){
  if(!isCooking())return;const r=thread().recipe,selected=cookingStep(),visual=RecipeRoomModel.visualSteps(r);
  main.querySelectorAll('[data-cooking-image]').forEach(host=>{const i=Number(host.dataset.cookingImage);window.RecipeImages?.mount(host,r,i,{autoCreate:thread().status==='active'&&i===selected&&visual.includes(i)})});
 }
 function jumpCookingStep(index){
  sync();if(!isCooking()||busy||saving||pending||preparing)return;const previous=book;
  try{book=M.setCookingStep(book,book.active,index,RecipeRoomModel.recipe)}catch{return}
  if(!persist()){book=previous;return}if(page!=='chat')open();
  renderChat();
  mountCookingImages();const target=main.querySelector('#cooking-step-'+index);target?.focus({preventScroll:true});target?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 function completeCookingStep(){
  sync();if(!isCooking()||!canSwitch())return;const previous=book,index=cookingStep();
  try{book=M.completeCookingStep(book,book.active,index,RecipeRoomModel.recipe)}catch{return}
  if(!persist()){book=previous;return}
  if(index===thread().recipe.steps.length-1){finishCooking();return}renderChat();main.querySelector('#cooking-step-'+cookingStep())?.scrollIntoView({block:'start',behavior:'smooth'});
 }
 function bindCookingControls(){
  main.querySelector('[data-complete-step]')?.addEventListener('click',completeCookingStep);
  main.querySelector('[data-cooking-ingredients]')?.addEventListener('click',showCookingIngredients);
  main.querySelector('[data-step-prev]')?.addEventListener('click',()=>jumpCookingStep(cookingStep()-1));main.querySelector('[data-step-next]')?.addEventListener('click',()=>jumpCookingStep(cookingStep()+1));
  main.querySelector('[data-step-select]')?.addEventListener('change',e=>jumpCookingStep(Number(e.target.value)));
  main.querySelectorAll('[data-jump-step]').forEach(b=>b.onclick=()=>jumpCookingStep(Number(b.dataset.jumpStep)));
 }
 function refreshCookingResume(){
  let el=document.getElementById('cooking-resume');if(!el){el=document.createElement('aside');el.id='cooking-resume';el.setAttribute('data-no-translate','');document.body.append(el)}
  const show=page!=='chat'&&isCooking()&&thread().status==='active';el.hidden=!show;if(!show)return;
  el.innerHTML='<button data-resume-cooking>'+kitchenBowl+'<span>'+esc(thread().title)+'<small>'+say((cookingStep()+1)+'. lépés','Step '+(cookingStep()+1))+'</small></span></button><button data-resume-ingredients>'+say('Hozzávalók','Ingredients')+'</button>';
  el.querySelector('[data-resume-cooking]').onclick=()=>jumpCookingStep(cookingStep());el.querySelector('[data-resume-ingredients]').onclick=showCookingIngredients;
 }
 function renderChat(){
  if(page!=='chat')return;sync();document.querySelector('.companion-header-history')?.setAttribute('aria-label',say('Beszélgetéstörténet','Conversation history'));cards=[];renderedDay=M.dayKey(Date.now());const messages=thread().messages;
  const welcome=isCooking()?'<p class="cooking-chat-hint">'+say('Kérdezz nyugodtan az aktuális lépésről, helyettesítésről vagy adagokról.','Ask about the current step, substitutions or servings.')+'</p>':'<div class="companion-welcome"><img src="assets/illustrations/morzsa-mascot.webp" width="90" height="90" alt=""><div class="workspace-welcome-copy"><h1>'+say('Mi főjön ki ma?','What shall we cook up?')+'</h1><p>'+say('Ötleteljünk, főzzünk, vagy mondd el, mi változott otthon.','Let’s cook, find an idea, or catch up on what changed at home.')+'</p></div><div class="companion-starters"><button data-prompt="familiar"><img src="assets/ui/heart.svg" alt="" width="22" height="22">'+say('Bevált ötlet','A familiar favourite')+'</button><button data-prompt="quick"><img src="assets/ui/chef-hat.svg" alt="" width="22" height="22">'+say('Gyors vacsora','Quick dinner')+'</button><button data-prompt="explore"><img src="assets/ui/sparkles.svg" alt="" width="22" height="22">'+say('Valami új','Something new')+'</button></div></div>';
  document.body.classList.toggle('workspace-cooking',isCooking());
  main.innerHTML='<section class="companion" data-no-translate><div class="companion-heading"><button data-history aria-label="'+say('Beszélgetéstörténet','Conversation history')+'">'+icon('history')+'</button><span>'+esc(isCooking()?say('Főzés','Cooking'):thread().kind==='main'||!thread().title?say('Morzsa · a kuktád','Morzsa · your kitchen companion'):thread().title)+'</span><button data-new-chat aria-label="'+say('Új beszélgetés','New chat')+'" title="'+say('Új beszélgetés','New chat')+'">'+icon('new')+'</button></div>'+ (isCooking()||thread().kind==='legacy'?'<button class="companion-back-main" data-main>← '+say('Vissza Morzsához','Back to Morzsa')+'</button>':'')+cookingHeader()+'<div class="companion-messages">'+cookingGuide()+renderMessages(messages,welcome)+proposal()+(failedAnswer?'<article class="companion-message model">'+ChatFormat.render(failedAnswer,ingredientText)+'<small class="companion-result">'+say('A válasz félbeszakadt. Módosítást nem mentettünk.','Response interrupted. No changes were saved.')+'</small></article>':'')+(busy?'<article class="companion-message model"><p data-stream-answer aria-live="off">'+esc(streamVisible)+'</p></article><p class="companion-thinking" '+(streamVisible?'hidden':'')+' role="status">'+say('Morzsa gondolkodik…','Morzsa is thinking…')+'</p>':'')+(error?'<div class="companion-error" role="alert"><p>'+esc(error)+'</p><button data-retry>'+say('Újrapróbálom','Try again')+'</button></div>':'')+'<div id="companion-nudge"></div><div id="companion-end"></div></div><div class="companion-compose-wrap">'+cookingDock()+'<div class="companion-tools" role="group" aria-label="'+say('Háztartási gyorsműveletek','Household shortcuts')+'"><button data-full="overview" aria-label="'+say('Áttekintés','Overview')+'" title="'+say('Áttekintés','Overview')+'">'+icon('overview')+'</button><button data-quick="pantry" aria-label="'+say('Készlet','Pantry')+'" title="'+say('Készlet','Pantry')+'">'+icon('home')+'</button><button data-quick="shopping" aria-label="'+say('Lista','Shopping list')+' · '+state.cart.filter(i=>!i.done).length+'" title="'+say('Lista','Shopping list')+'">'+icon('cart')+(state.cart.some(i=>!i.done)?'<small aria-hidden="true">'+state.cart.filter(i=>!i.done).length+'</small>':'')+'</button></div>'+(attachment?'<div class="companion-attachment"><img src="'+attachment.photo+'" alt="'+say('Kiválasztott fotó','Selected photo')+'"><span>'+say('Küldéskor Morzsa megnézi','Morzsa will look when you send')+'</span><button type="button" data-remove-photo aria-label="'+say('Fotó eltávolítása','Remove photo')+'">×</button></div>':'')+'<form id="companion-form"><button type="button" data-photo aria-label="'+say('Fotó csatolása','Attach photo')+'" '+(busy||saving||pending||preparing?'disabled':'')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg></button><input type="file" id="companion-photo" accept="image/jpeg,image/png,image/webp" hidden><textarea id="companion-input" rows="1" maxlength="2000" aria-label="'+say('Üzenet Morzsának','Message Morzsa')+'" placeholder="'+(isCooking()?say('Kérdezz erről a lépésről…','Ask about this cooking step…'):composerOrigin==='pantry'?say('Mi fogyott el? Mire lenne szükség?','What ran out? What do you need?'):composerOrigin==='shopping'?say('Miben segítsek a bevásárlásnál?','How can I help with shopping?'):composerOrigin==='recipes'?say('Mit főzzünk? Milyen ötletet keresel?','What shall we cook? Any preferences?'):say('Kérdezz…','Ask…'))+'">'+esc(draft)+'</textarea><button type="button" data-mic aria-label="'+say('Kérdezés hanggal','Ask by voice')+'" '+(busy||saving||pending?'disabled':'')+'>'+voiceMicIcon+'</button><button type="submit" aria-label="'+(busy?say('Válasz leállítása','Stop response'):say('Küldés','Send'))+'" '+(saving||pending||preparing?'disabled':'')+'>'+(busy?'■':icon('arrow'))+'</button></form><div class="companion-disclosure">'+(!household?.userId()?'<button data-login>'+say('Belépés az AI-beszélgetéshez','Sign in to chat with AI')+'</button>':'<span>'+say('A változtatásokat mentés előtt átnézheted.','Review changes before saving.')+'</span>')+'</div></div></section>';
  main.querySelector('[data-past]')?.addEventListener('toggle',e=>{if(e.target.isConnected)showPast=e.target.open});
  main.querySelectorAll('[data-day]').forEach(el=>el.addEventListener('toggle',()=>{if(!el.isConnected||el.open===expandedDays.has(el.dataset.day))return;el.open?expandedDays.add(el.dataset.day):expandedDays.delete(el.dataset.day);const key=el.dataset.day,y=scrollY;renderChat();main.querySelector('[data-day="'+key+'"] summary')?.focus({preventScroll:true});window.scrollTo(0,y)}));
  main.querySelector('[data-photo]').onclick=()=>main.querySelector('#companion-photo').click();
  main.querySelector('[data-remove-photo]')?.addEventListener('click',()=>{attachment=null;photoSerial++;renderChat()});
  main.querySelector('#companion-photo').onchange=async e=>{
   const file=e.target.files[0];if(!file)return;
   const current=context,tid=book.active,id=++photoSerial;preparing=true;renderChat();
   try{const ready=await ChatPhoto.prepare(file);if(current===scope()&&tid===book.active&&id===photoSerial)attachment=ready}
   catch{if(current===scope()&&tid===book.active&&id===photoSerial)toast(say('JPG, PNG vagy WebP fotót válassz, legfeljebb 12 MB méretben.','Choose a JPG, PNG or WebP photo up to 12 MB.'))}
   finally{if(current===scope()&&tid===book.active&&id===photoSerial){preparing=false;renderChat();main.querySelector('#companion-input')?.focus()}}
  };
  const input=main.querySelector('#companion-input');input.oninput=()=>{draft=input.value;input.style.height='auto';input.style.height=Math.min(input.scrollHeight,110)+'px'};
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send(input.value)}};
  main.querySelector('#companion-form').onsubmit=e=>{e.preventDefault();if(busy)requestController?.abort();else send(input.value)};
  main.querySelector('[data-history]').onclick=history;main.querySelector('[data-new-chat]').onclick=newChat;renderHistoryRail();
  main.querySelector('[data-main]')?.addEventListener('click',()=>goMain());
  main.querySelector('[data-current-recipe]')?.addEventListener('click',()=>{recipeDetails=!(recipeDetails??matchMedia('(min-width:1000px)').matches);const y=scrollY;renderChat();window.scrollTo(0,y)});
  main.querySelector('[data-finish-cooking]')?.addEventListener('click',finishCooking);
  main.querySelector('[data-cook-again]')?.addEventListener('click',()=>discuss(thread().recipe));
  main.querySelector('[data-mic]').onclick=voice;
  main.querySelector('[data-login]')?.addEventListener('click',()=>document.getElementById('household-button').click());
  main.querySelector('[data-retry]')?.addEventListener('click',()=>send(thread().messages.at(-1)?.text||'',true));
  main.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>quick(b.dataset.quick));main.querySelectorAll('[data-full]').forEach(b=>b.onclick=()=>dashboardGo(b.dataset.full));
  main.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>send(({familiar:say('Adj egy bevált jellegű receptötletet a kedvenceink és a gyakran vásárolt alapanyagok alapján. Főleg abból főzzünk, ami most otthon van. Vedd figyelembe a főzési ízlésünket; ha még nincs előzmény, kérj egy rövid támpontot vagy adj egy egyszerű ötletet.', 'Suggest a familiar-style recipe based on our favourites and frequently purchased ingredients, prioritizing what is at home now and our cooking preferences. If there is no history, ask one brief question or suggest a simple dish.'),quick:say('Mi legyen a vacsora? Van rá 25 percem. Adj receptet.','What can I cook in 25 minutes? Give me a recipe.'),explore:say('Próbáljunk ki valami újat! Adj a közelmúltban főzöttektől eltérő receptet, főleg az otthoni alapanyagokból, legfeljebb két új, egyértelműen hiányzó hozzávalóval. Tartsd meg az ízlésbeli megkötéseinket.', 'Let’s try something new! Suggest a recipe different from our recent meals, mostly using what is at home, with at most two new, clearly missing ingredients. Respect our dietary and ingredient preferences.')})[b.dataset.prompt],false,true));
  main.querySelector('[data-companion-apply]')?.addEventListener('click',apply);main.querySelector('[data-companion-edit]')?.addEventListener('click',editProposal);main.querySelector('[data-companion-discard]')?.addEventListener('click',()=>{markResult(say('Elvetve, nem módosítottunk semmit.','Dismissed; nothing was changed.'));renderChat()});
  main.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>{const key=RecipeShopping.key(cards[Number(b.dataset.recipe)]);expandedRecipes.has(key)?expandedRecipes.delete(key):expandedRecipes.add(key);const y=scrollY;renderChat();window.scrollTo(0,y)});
  main.querySelectorAll('[data-recipe-favourite]').forEach(b=>b.onclick=()=>{if(window.RecipeRoom.toggleFavourite(cards[Number(b.dataset.recipeFavourite)])){const y=scrollY;renderChat();window.scrollTo(0,y)}});
  main.querySelectorAll('[data-cook]').forEach(b=>b.onclick=()=>discuss(cards[Number(b.dataset.cook)]));
  main.querySelectorAll('[data-inline-recipe]').forEach(host=>RecipeRoom.mount(host,cards[Number(host.dataset.inlineRecipe)]));
  if(isCooking())window.RecipeImages?.mount(main.querySelector('#cooking-cover'),thread().recipe,-1,{autoCreate:true,hero:true});
  if(isCooking()&&(recipeDetails??matchMedia('(min-width:1000px)').matches))RecipeRoom.mount(main.querySelector('#cooking-ingredients'),thread().recipe,{ingredientsOnly:true});
  mountCookingImages();
  bindCookingControls();
  main.querySelectorAll('[data-generated-recipe]').forEach(host=>window.RecipeImages?.mount(host,cards[Number(host.dataset.generatedRecipe)]));
  updateNudge();viewport();animateAnswer();window.MorzsaWorkspace?.mount();
 }
 function scrollEnd(){requestAnimationFrame(()=>main.querySelector('#companion-end')?.scrollIntoView({block:'end',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}))}
 function panel(id){let q=document.getElementById(id);if(!q){q=document.createElement('dialog');q.id=id;q.setAttribute('data-no-translate','');document.body.append(q);PanelGestures.bind(q,{axis:id==='companion-history'?'x':'y',allowControls:id==='companion-history'})}return q}
 function historyMarkup(rail=false){
  const groups=M.historyGroups(book),disabled=busy||saving||pending||preparing;
  const row=t=>'<button class="history-thread" data-thread="'+esc(t.id)+'" '+(disabled?'disabled':'')+' aria-current="'+(t.id===book.active)+'">'+ui(t.kind==='recipe'?'chef-hat':'message-circle')+'<strong>'+esc(t.title||(t.kind==='main'?say('Morzsa · a kuktád','Morzsa · your kitchen companion'):say('Új beszélgetés','New chat')))+'</strong><small>'+new Date(t.updated).toLocaleDateString(language==='en'?'en-GB':'hu-HU',{month:'short',day:'numeric'})+(t.kind==='recipe'?' · '+say(t.status==='completed'?'Megfőzve':'Folyamatban',t.status==='completed'?'Cooked':'In progress'):t.archivedAt?' · '+say('Archivált','Archived'):'')+'</small></button>';
  return '<div class="companion-panel-head"><h2>'+say('Beszélgetések','Conversations')+'</h2>'+(rail&&isCooking()?'<button data-cooking-history aria-label="'+say('Beszélgetések megnyitása','Open conversations')+'">'+ui('arrow-right')+'</button>':'')+(!rail?'<button data-close aria-label="'+say('Bezárás','Close')+'">×</button>':'')+'</div><button class="companion-new" data-new-chat '+(disabled?'disabled':'')+'>'+say('Új beszélgetés','New chat')+ui('plus')+'</button><div class="companion-history-items"><h3>Morzsa</h3>'+groups.recent.map(row).join('')+(groups.archive.length?'<details class="history-archive" '+(groups.archive.some(t=>t.id===book.active)?'open':'')+'><summary>'+ui('archive')+say('Archívum','Archive')+' <small>'+groups.archive.length+'</small></summary>'+groups.archive.map(row).join('')+'</details>':'')+'<h3>'+ui('chef-hat')+say('Receptek','Recipes')+'</h3>'+(groups.recipes.length?groups.recipes.map(row).join(''):'<p class="companion-caption">'+say('Az elkezdett receptek itt jelennek meg.','Recipes you start appear here.')+'</p>')+'</div>'+(!isCooking()?'<button class="history-archive-current" data-archive '+(disabled||!thread().messages.length?'disabled':'')+'>'+say(thread().archivedAt?'Vissza a beszélgetésekhez':'Beszélgetés archiválása',thread().archivedAt?'Return to conversations':'Archive conversation')+'</button>':'')+'<p class="companion-caption history-privacy">'+say('Ezen az eszközön · ebben a háztartásban','This device · this household')+'</p>';
 }
 function bindHistory(host){
  host.querySelector('[data-cooking-history]')?.addEventListener('click',history);
  host.querySelector('[data-close]')?.addEventListener('click',()=>host.close());host.querySelector('[data-new-chat]').onclick=newChat;host.querySelector('[data-archive]')?.addEventListener('click',archiveCurrent);
  host.querySelectorAll('[data-thread]').forEach(b=>b.onclick=()=>selectThread(b.dataset.thread));
 }
 function renderHistoryRail(){
  let rail=document.getElementById('companion-history-rail');
  if(!rail){rail=document.createElement('aside');rail.id='companion-history-rail';rail.setAttribute('data-no-translate','');rail.setAttribute('aria-label',say('Beszélgetéstörténet','Conversation history'));document.body.append(rail)}
  rail.hidden=!matchMedia('(min-width:1000px)').matches;if(rail.hidden)return;const y=rail.querySelector('.companion-history-items')?.scrollTop||0;rail.innerHTML=historyMarkup(true);bindHistory(rail);rail.querySelector('.companion-history-items').scrollTop=y;
 }
 function history(){
  sync();if(matchMedia('(min-width:1000px)').matches){renderHistoryRail();document.querySelector('#companion-history-rail [aria-current="true"]')?.focus();return null}
  const q=panel('companion-history');q.innerHTML=historyMarkup();bindHistory(q);if(!q.open)q.showModal();return q;
 }
 function removed(names){sync();removedNames=[...new Set([...names,...removedNames])].slice(0,10);updateNudge()}
 function nudge(){if(isCooking()||busy||saving||pending)return null;const existing=M.suggestion(state,PantryReview?.candidates()||[],removedNames,deferred),refill=typeof KitchenModel==='undefined'?null:KitchenModel.shoppingSuggestion(state,deferred),n=['bought','restock'].includes(existing?.type)?existing:refill||existing;return ['review','low','recurring'].includes(n?.type)&&Date.now()<quietUntil?null:n}
 function updateNudge(){
  if(context!==scope())return;
  const host=main.querySelector('#companion-nudge');if(!host||host.querySelector('[data-inline-review]'))return;const n=nudge();if(!n){host.innerHTML='';return}
  if(n.type==='review'){
   const current=context,all=M.reviewPreview(PantryReview.candidates(),state.stock,deferred),items=all.slice(0,3);
   PantryReview.open({host,items,onClose:()=>{if(current!==scope())return;for(const item of items)deferred['review:'+item.name]=Date.now()+86400000;try{localStorage.setItem(context+':snooze',JSON.stringify(deferred))}catch{}updateNudge()}});
   if(all.length>items.length){const more=document.createElement('button');more.className='small-button review-more';more.textContent=say('Többet átnézek','Review more');more.onclick=()=>PantryReview.open({items:all});host.querySelector('[data-inline-review]')?.append(more)}return;
  }
  const name=n.names.map(displayName).join(', '),title=n.type==='bought'?say('Megvolt a bevásárlás?','Finished shopping?'):['restock','low','recurring'].includes(n.type)?say('Felírjam a listára?','Add it to the list?'):name+say(' · megvan még?',' · still at home?');
  const text=n.type==='bought'?n.names.length+say(' kipipált tételt a készletbe tehetünk.',' checked items can move to your pantry.'):n.type==='low'?name+say(' · kevésnek jelöltétek.',' · marked as running low.'):n.type==='recurring'?name+say(' · többször vettétek mostanában, és most elfogyottnak jelöltétek.',' · bought repeatedly recently and now marked as used up.'):n.type==='restock'?name+say(' elfogyott. Gondoskodjunk az utánpótlásról?',' ran out. Shall we get some more?'):n.unknown?say('Ezt még nem ellenőriztük együtt.','We haven’t checked this together yet.'):say('Egy ideje nem erősítettétek meg.','It has been a while since you checked.');
  host.innerHTML='<aside class="companion-nudge"><div class="companion-speaker"><img src="assets/brands/morzsa.svg" width="18" height="18" alt="">'+say('Egy apróság…','One small thing…')+'</div><strong>'+esc(title)+'</strong><p>'+esc(text)+'</p><div class="companion-actions">'+(n.type==='review'?'<button data-nudge="keep">'+say('Van még','Still here')+'</button><button data-nudge="gone">'+say('Elfogyott','Used up')+'</button><button data-nudge="review">'+say('Többet átnézek','Review more')+'</button>':'<button data-nudge="'+(n.type==='bought'?'bought':'list')+'">'+(n.type==='bought'?say('Elpakoltam','Put away'):say('Listára','Add to list'))+'</button>')+'<button data-nudge="later">'+say('Most nem','Not now')+'</button></div></aside>';
  host.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=async()=>{
   if(context!==scope()||saving||household?.busy||household?.cartPending||nudge()?.id!==n.id)return;
   if(b.dataset.nudge==='later'){deferred[n.id]=Date.now()+86400000;if(['low','recurring'].includes(n.type))n.names.forEach(name=>deferred['refill:'+name]=Date.now()+86400000);try{localStorage.setItem(context+':snooze',JSON.stringify(Object.fromEntries(Object.entries(deferred).filter(([,v])=>v>Date.now()).slice(-100))))}catch{}updateNudge();return}
   if(b.dataset.nudge==='review'){PantryReview.open();return}
   const current=context;host.querySelectorAll('button').forEach(x=>x.disabled=true);
   if(b.dataset.nudge==='keep')await PantryReview.confirm(n.names);
   if(b.dataset.nudge==='gone')await PantryReview.remove(n.names);
   if(b.dataset.nudge==='list')await addToList(n.names);
   if(b.dataset.nudge==='bought'){await completeShopping(false);if(page==='chat')renderChat()}
   if(current===scope())updateNudge();
  });
 }
 async function addToList(name){
  const names=(Array.isArray(name)?name:[name]).filter(n=>!state.cart.some(i=>i.name===n));if(!names.length)return;
  const plan=WorkspaceEntry.plan(state,names,'cart',catalog,productUnit,QuickEntry.norm),next=plan.next;
  const current=context,undoContext=voiceContext();
  if(household?.busy||household?.cartPending)return;
  const ok=household?.active?household.editCart(next,{onlyIfMissing:true}):commitState(next);
  if(ok&&current===scope()){basketFeedback(names[0]);toast(say('A listára került.','Added to list.'));if(!household?.active)showVoiceUndo(names.map(n=>({bucket:'cart',key:n,before:undefined,after:next.cart.find(i=>i.name===n)})),undoContext);renderChat()}
 }
 async function ingredientActions(name,anchor){
  sync();if(![...catalog,...state.custom].some(i=>i.name===name))return;
  const current=context,previous=main.querySelector('.ingredient-inline-actions');if(previous?.dataset.saving)return;
  const same=previous?.dataset.name===name;previous?.remove();if(same||!anchor?.isConnected)return;
  const q=document.createElement('section');q.className='ingredient-inline-actions';q.dataset.name=name;q.setAttribute('role','group');q.setAttribute('aria-label',displayName(name));(anchor.closest('p,li,h4')||anchor.closest('.companion-message')).after(q);let working=false;
  function paint(){
   if(current!==scope()){q.remove();return}const home=state.stock[name]>0,listed=state.cart.some(i=>i.name===name);
   q.innerHTML='<div class="companion-sheet-handle" aria-hidden="true"></div><button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><div class="ingredient-action-heading"><img src="'+(productArtwork[name]||'assets/icons/oats.webp')+'" alt="" width="52" height="52"><div><h2 id="ingredient-action-title">'+esc(displayName(name))+'</h2><p>'+say(home?'Van otthon':'Nincs megjelölve otthon',home?'At home':'Not marked at home')+(listed?say(' · A listán is',' · On the list'):'')+'</p></div></div><div class="ingredient-action-buttons"><button data-ingredient-list '+(listed?'disabled':'')+'>'+icon('cart')+say(listed?'Már a listán':'Listára teszem',listed?'Already on list':'Add to list')+'</button><button data-ingredient-stock '+(home?'disabled':'')+'>'+icon('home')+say(home?'Van otthon':'Van otthon',home?'At home':'Add to pantry')+'</button></div><p class="ingredient-action-error" role="status"></p>';
   q.querySelector('.close').onclick=()=>{if(!working)q.remove()};q.oncancel=e=>{if(working)e.preventDefault()};
   q.querySelector('[data-ingredient-list]').onclick=()=>act('list');q.querySelector('[data-ingredient-stock]').onclick=()=>act('stock');
  }
  async function act(destination){
   if(working||current!==scope())return;if(household?.busy||household?.cartPending){q.querySelector('.ingredient-action-error').textContent=say('A szinkronizálás még tart. Próbáld újra.','Still syncing. Try again.');return}
   if(destination==='list'&&state.cart.some(i=>i.name===name)||destination==='stock'&&state.stock[name]>0){paint();return}
   working=true;q.dataset.saving=String(true);q.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{if(destination==='list'){await addToList(name);if(current!==scope())return;if(!state.cart.some(i=>i.name===name))throw Error('save')}
    else{const undoContext=voiceContext(),plan=VoiceModel.plan(state,[{action:'stock_add',name,quantity:null,unit:null}],[...catalog,...state.custom],productUnit);if(!await saveVoiceState(plan.next))throw Error('save');if(current!==scope())return;await PantryReview.confirm([name]);showVoiceUndo(plan.changes,undoContext);renderChat()}
    if(current===scope())q.remove();
   }catch{if(current===scope()){paint();q.querySelector('.ingredient-action-error').textContent=say('Nem sikerült menteni. Próbáld újra.','Could not save. Try again.')}}finally{working=false;delete q.dataset.saving}
  }
  paint();
 }
 // Delegation also covers messages that finish streaming without a full rebind.
 let mentionHold=null,heldName='',suppressMentionClickUntil=0;
 const cancelMentionHold=()=>{clearTimeout(mentionHold);mentionHold=null};
 main.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-mention]');if(!b||e.button!==0)return;cancelMentionHold();const start={x:e.clientX,y:e.clientY},current=scope();heldName=b.dataset.mention;mentionHold=setTimeout(()=>{mentionHold=null;if(current!==scope()||!b.isConnected)return;suppressMentionClickUntil=Date.now()+700;ingredientActions(b.dataset.mention,b)},450);b.onpointermove=event=>{if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>10)cancelMentionHold()}});
 for(const event of ['pointerup','pointercancel','pointerleave'])main.addEventListener(event,cancelMentionHold);
 main.addEventListener('click',e=>{const b=e.target.closest('[data-mention]');if(!b)return;e.preventDefault();cancelMentionHold();if(b.dataset.mention===heldName&&Date.now()<suppressMentionClickUntil)return;ingredientActions(b.dataset.mention,b)});
 main.addEventListener('contextmenu',e=>{const b=e.target.closest('[data-mention]');if(!b)return;e.preventDefault();cancelMentionHold();if(Date.now()>=suppressMentionClickUntil)ingredientActions(b.dataset.mention,b)});
 function quick(destination){
  sync();const q=panel('companion-quick'),current=context;let query='';
  function paint(){
   if(current!==scope()){q.close();return}const isList=destination==='shopping',names=isList?state.cart.map(i=>i.name):Object.keys(state.stock).filter(n=>state.stock[n]>0).sort((a,b)=>compareProducts({name:a},{name:b}));
   const visible=names.filter(n=>!query||QuickEntry.norm(displayName(n)).includes(QuickEntry.norm(query)));const cats=[...new Set(visible.map(productCategory))].sort((a,b)=>categoryPriorityOrder.indexOf(a)-categoryPriorityOrder.indexOf(b));
   q.innerHTML='<div class="companion-sheet-handle" aria-hidden="true"></div><div class="companion-panel-head"><h2>'+say(isList?'Bevásárlólista':'Mi van otthon?',isList?'Shopping list':'Your pantry')+'</h2><button data-close aria-label="'+say('Bezárás','Close')+'">×</button></div><div class="companion-panel-tools"><span>'+names.length+say(' termék',' products')+'</span><button data-expand>'+say('Teljes nézet','Full view')+' ↗</button></div><div class="companion-quick-items">'+(visible.length?cats.map(c=>'<section><h3>'+esc(language==='en'?englishText(c):c)+'</h3>'+(isList?'<div>':'<div class="companion-stock-grid">')+visible.filter(n=>productCategory(n)===c).map(n=>{const i=names.indexOf(n),item=state.cart.find(x=>x.name===n);return isList?'<div class="companion-list-row"><input type="checkbox" id="quick-cart-'+i+'" data-check="'+i+'" '+(item.done?'checked':'')+'><span><label for="quick-cart-'+i+'">'+esc(displayName(n))+'</label>'+(window.RecipeRoom?.sourceMarkup(item)||'')+'</span><small>'+esc(cartAmount(item))+'</small></div>':'<article class="companion-stock-item"><img src="'+(productArtwork[n]||'assets/icons/oats.webp')+'" alt="" width="40" height="40"><strong>'+esc(displayName(n))+'</strong><small>'+pantryStateLabel(WorkspaceEntry.availability(state.stock[n]))+(item?say(' · Listán',' · Listed'):'')+'</small><div><button data-list="'+i+'" '+(item?'disabled':'')+' aria-label="'+esc(displayName(n))+say(' a listára',' to list')+'">'+icon('cart')+'</button><button data-gone="'+i+'">'+say('Elfogyott','Used up')+'</button></div></article>'}).join('')+'</div></section>').join(''):'<p class="companion-caption">'+say(isList?'A listád most üres.':'Most nincs megjelölt termék.',isList?'Your list is empty.':'No products marked at home.')+'</p>')+'</div><button class="companion-quick-add" data-add>＋ '+say(isList?'Felírok valamit':'Hozzáadok valamit',isList?'Add to list':'Add to pantry')+'</button>';
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
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReveal();else if(page==='chat'&&renderedDay!==M.dayKey(Date.now())&&!busy&&!pending)renderChat();else updateNudge()});
 document.querySelector('header').insertAdjacentHTML('afterbegin','<button class="companion-header-history" aria-label="Beszélgetéstörténet" data-no-translate>☰</button>');
 document.querySelector('.companion-header-history').onclick=()=>{history()};
 const edge=document.createElement('div');edge.className='companion-history-edge';edge.setAttribute('aria-hidden','true');document.body.append(edge);PanelGestures.bind(edge,{axis:'x',edge:true,disabled:()=>matchMedia('(min-width:1000px)').matches||!!document.querySelector('dialog[open]'),open:history});
 PanelGestures.bind(main,{axis:'x',edge:true,ignoreControls:true,allowInline:true,disabled:()=>page!=='chat'||matchMedia('(min-width:1000px)').matches||!!document.querySelector('dialog[open]'),open:history});
 window.addEventListener('resize',()=>{if(matchMedia('(min-width:1000px)').matches)document.getElementById('companion-history')?.close();renderHistoryRail()});
 setInterval(()=>{if(!document.hidden&&page==='chat'&&!busy&&!saving&&!pending&&!preparing&&renderedDay!==M.dayKey(Date.now()))renderChat()},30000);
 sync();queueMicrotask(()=>render());
 return {openContext:origin=>{goMain('',origin);main.querySelector('#companion-input')?.focus()},newChat,recipeThreads:()=>{sync();return M.historyGroups(book).recipes.filter(t=>t.recipe).map(t=>({id:t.id,title:t.title,status:t.status,updated:t.updated,recipe:structuredClone(t.recipe)}))},openThread:selectThread,ask,voice:askVoice,render:renderChat,open:goMain,onNavigate,updateNudge,removed,quick,refreshQuick:()=>refreshQuick(),purchaseSaved:(before,after,ctx)=>showVoiceUndo(M.changes(before,after),ctx),discuss,showRecipe:r=>{if(discuss(r))showCookingIngredients()}};
})();
