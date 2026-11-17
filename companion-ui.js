// Chat-first shell. AI suggestions are proposals; mutations use existing save paths.
window.MorzsaCompanion=(()=>{
 const M=CompanionModel,C=CookingSession,say=(hu,en)=>language==='en'?en:hu;
 let context='',book={threads:[]},draft='',busy=false,saving=false,error='',pending=null,serial=0,removedNames=[],deferred={},quietUntil=0;
 let streamText='',streamVisible='',failedAnswer='',requestController=null,streamFrame=0;
 let composerOrigin='',drafts=new Map(),expandedRecipes=new Set(),expandedDays=new Set(),recipeDetails=null,cookingView='full',cookingQuestion=false,showPast=false,renderedDay='';
 const isCooking=()=>thread()?.kind==='recipe',mainThread=()=>{const active=thread();return (active?.kind!=='recipe'&&!active?.archivedAt?active:null)||book.threads.find(t=>t.id===active?.parentId&&!t.archivedAt&&t.kind!=='recipe')||M.historyGroups(book).recent[0]||book.threads.find(t=>t.kind==='main')};
 function resetStream(){cancelAnimationFrame(streamFrame);streamFrame=0;streamText='';streamVisible=''}
 function paintStream(){
  if(streamFrame)return;
  const tick=()=>{
   streamFrame=0;const el=main.querySelector('[data-stream-answer]');if(!el)return;
   const follow=scrollY+innerHeight>=document.documentElement.scrollHeight-100;
   // Render every received character on the next frame; never simulate typing.
   streamVisible=streamText;el.textContent=streamVisible;main.querySelector('.companion-thinking')?.toggleAttribute('hidden',!!streamVisible);
   if(follow)window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
  };streamFrame=requestAnimationFrame(tick);
 }
 // Ingredient choices are UI drafts per kitchen and chat; sent requests use ordinary persisted messages.
 let craftDrafts=new Map(),craftQuestion=false;
 const craftKey=()=>JSON.stringify([context,household?.active||'local',book.active]);
 const craftState=()=>craftDrafts.get(craftKey());
 const craftResolve=n=>QuickEntry.match(n,[...catalog,...state.custom],productEnglish)||n;
 const discoveries=()=>CraftingModel.discoveries(book,RecipeRoomModel.recipe);
 function openCraft(names){
  sync();if(isCooking()||thread().readOnly||!canSwitch())return;
  craftQuestion=false;const key=craftKey(),prior=craftDrafts.get(key);craftDrafts.set(key,{...prior,open:true,...(Array.isArray(names)?{snapshot:{selected:names.map(craftResolve),query:'',category:'',homeOnly:false,limit:8}}:{})});
  const y=scrollY;renderChat();const card=main.querySelector('.companion-crafting');if(card){card.setAttribute('tabindex','-1');card.focus({preventScroll:true});window.scrollTo({top:thread().messages.length?Math.max(0,card.getBoundingClientRect().top+scrollY-16):0,behavior:'instant'})}
 }

 function craftingMarkup(){
  if(isCooking()||thread().readOnly||busy||saving||pending)return '';const state=craftState();if(!state)return '';
  if(!state.open)return thread().messages.length&&state.snapshot?.selected.length?'<button class="companion-craft-again small-button" data-open-craft>'+ui('chef-hat')+say('Kotyvasszunk újra','Mix something else')+'</button>':'';
  return '<section class="companion-crafting" aria-label="'+say('Kotyvasszunk Morzsával','Mix and discover with Morzsa')+'"><div class="companion-crafting-head"><span class="companion-speaker"><img src="assets/brands/morzsa.svg" width="20" height="20" alt="">Morzsa · '+say('Kotyvasszunk','Mix & discover')+'</span><button type="button" data-close-craft aria-label="'+say('Vissza a beszélgetéshez','Back to conversation')+'">'+ui('x')+'</button></div><div data-craft-chat></div></section>';
 }
 let attachment=null,retryAttachment=null,preparing=false,photoSerial=0;
 const cloudEnabled=()=>window.MorzsaPersistence&&PersistenceModel.uuid(household?.userId())&&household?.dataRpc;
 const scope=()=>cloudEnabled()?PersistenceModel.accountKey(household.userId()):M.workspaceKey(household?.userId(),household?.active,language),thread=()=>book.threads.find(t=>t.id===book.active);
 const ui=name=>'<img class="workspace-icon" src="assets/ui/'+name+'.svg" alt="" width="22" height="22">';
 const icon=name=>ui(({history:'menu',new:'plus',close:'x',arrow:'arrow-up',cart:'shopping-cart',home:'house',overview:'layout-grid'})[name]);
 // Presentation only: full answers are saved immediately; old chats never replay.
 let mentionIndex=null,mentionKey='';
 function ingredientText(text){
  const actual=isCooking()?new Set(thread().recipe.ingredients.map(i=>QuickEntry.match(i.name,[...catalog,...state.custom],productEnglish)||i.name)):null,products=[...catalog,...state.custom].filter(i=>!actual||actual.has(i.name));
  const key=JSON.stringify(products.map(i=>i.name));if(!mentionIndex||key!==mentionKey){mentionKey=key;mentionIndex=IngredientMentions.build(products,productEnglish)}
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
 function formattedAnswer(m){const match=m.role==='model'&&m.recipes?.length?m.text.match(/\n\s*(?:#{1,3}\s*)?(Miért ezt ajánlom\??|Why (?:I recommend this|this recipe)\??)\s*\n/i):null;if(!match)return ChatFormat.render(m.text,ingredientText);const index=match.index;return ChatFormat.render(m.text.slice(0,index),ingredientText)+'<details class="answer-rationale"><summary>'+say('Miért ezt ajánlom?','Why this recipe?')+'</summary>'+ChatFormat.render(m.text.slice(index+match[0].length),ingredientText)+'</details>';}
 function answerText(m,i){
  const receipt=m.role==='user'?CraftingModel.receipt(m.text,language):null;if(receipt)return '<p class="craft-receipt">'+ui('chef-hat')+'<span>'+ingredientText(receipt)+'</span></p>';
  if(m.text.startsWith(WeeklyPlanModel.schedulePrefix))return '<p>'+say('A heti napok és adagok módosítva. A tervet fent áttekintheted; a lista nem módosult.','Weekly days and portions updated. Review the plan above; the shopping list is unchanged.')+'</p>';
  if(!reveal||m.role!=='model'||i!==reveal.index||book.active!==reveal.thread)return formattedAnswer(m);
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
 let lastActivity=Date.now(),sessionTimer=0,resumeSerial=0;
 function savePosition(){
  clearTimeout(sessionTimer);if(!context||!thread()||context!==scope())return;
  const saved={version:1,activity:lastActivity,page,thread:book.active,scroll:scrollY,draft,cookingView,shoppingActive:!!window.ShoppingMode?.visible(),preview:page==='recipes'?window.RecipeRoom?.reading():null,previewPortions:page==='recipes'&&window.RecipeRoom?.reading()?RecipeRoom.portionsFor(RecipeRoom.reading()):null};
  try{localStorage.setItem(MorzsaSessionModel.key(context),JSON.stringify(saved))}catch{}
 }
 function restorePosition(saved,foreground=false){
  const decision=MorzsaSessionModel.decide(saved,book,Date.now(),busy||saving||pending||preparing||!!attachment||!!draft.trim()||!!document.querySelector('dialog[open]'));
  if(decision==='unchanged')return false;
  if(decision==='fresh'){
   const active=thread();
   // Reuse an empty general chat. Expiry never deletes or archives history.
   if(active?.kind==='recipe'||active?.archivedAt||active?.messages.length){
    try{book=M.startChat(book,crypto.randomUUID(),RecipeRoomModel.recipe)}catch{return false}
   }
   page='chat';draft='';cookingView='full';recipeDetails=null;
  }else{
   if(!foreground){book.active=saved.thread;draft=saved.draft;cookingView=saved.cookingView;page=saved.page;window.RecipeRoom?.restoreReading(page==='recipes'?saved.preview:null,saved.previewPortions)}
  }
  persist();lastActivity=Date.now();const id=++resumeSerial,current=context,tid=book.active;
  if(!foreground||decision==='fresh'){
   requestAnimationFrame(()=>{if(id!==resumeSerial||current!==scope()||tid!==book.active)return;window.scrollTo({top:decision==='resume'?saved.scroll:0,behavior:'instant'});savePosition()});
  }else savePosition();
  return decision==='fresh';
 }
 function resumeSession(){
  if(document.hidden)return;sync();const saved=MorzsaSessionModel.normalize(safeRead(MorzsaSessionModel.key(context)),RecipeRoomModel.recipe);
  if(restorePosition(saved,true))render();
 }
 function sync(){
  const next=scope();if(context===next)return;
  craftDrafts.clear();window.CraftingRoom?.cleanup();stopReveal();requestController?.abort();requestController=null;resetStream();failedAnswer='';attachment=null;retryAttachment=null;preparing=false;photoSerial++;context=next;serial++;busy=false;startingTurn=false;retryRequest=null;pendingSend=null;saving=false;pending=null;error='';draft='';removedNames=[];quietUntil=0;deferred=safeRead(context+':snooze')||{};
  const legacyKey=M.key(household?.userId(),household?.active,language);
  book=M.normalize(cloudEnabled()?(safeRead(context)||{cloud:true,threads:[]}):safeRead(context)||safeRead(M.dailyWorkspaceKey(household?.userId(),household?.active,language))||safeRead(M.previousWorkspaceKey(household?.userId(),household?.active,language))||safeRead(legacyKey),RecipeRoomModel.recipe,61);
  if(!book.threads.length){
   // Copy legacy conversation without modifying or deleting its original storage.
   const old=RecipeRoomModel.messages(safeRead(RecipeRoomModel.conversationKey(household?.userId(),household?.active,language)));
   if(old.length){const t=M.fresh(crypto.randomUUID());t.messages=old;t.title=old.find(m=>m.role==='user')?.text.slice(0,60)||'';book.threads=[t];book.active=t.id;}
  }
  if(cloudEnabled()){book.cloud=true;for(const t of book.threads){if(!PersistenceModel.uuid(t.id))t.id=crypto.randomUUID();for(const m of t.messages)if(!PersistenceModel.uuid(m.id))m.id=crypto.randomUUID()}}
  book=M.workspace(book,RecipeRoomModel.recipe);drafts=new Map();expandedRecipes=new Set();expandedDays=new Set();showPast=false;persist();
  if(cloudEnabled())MorzsaPersistence.attach(book,{safe:()=>!busy&&!saving&&!pending&&!preparing&&!window.MorzsaRealtime?.running()&&!document.activeElement?.matches('textarea,input[type=search]'),changed:next=>{const y=scrollY;book=M.workspace(next,RecipeRoomModel.recipe);try{localStorage.setItem(context,JSON.stringify(book))}catch{}if(page==='chat'&&!busy&&!pending&&!preparing&&!document.activeElement?.matches('textarea,input[type=search]')){renderChat();window.scrollTo({top:y,behavior:'instant'})}else if(page==='recipes')RecipeRoom.render();renderHistoryRail();if(document.querySelector('#companion-history[open]')&&!document.querySelector('[data-confirm-share]'))history();return book},saved:()=>{try{localStorage.setItem(context,JSON.stringify(book))}catch{}},status:()=>renderHistoryRail()});else window.MorzsaPersistence?.detach();
  closePanels();lastActivity=Date.now();restorePosition(MorzsaSessionModel.normalize(safeRead(MorzsaSessionModel.key(context)),RecipeRoomModel.recipe));
 }
 function persist(){
  book=M.workspace(book,RecipeRoomModel.recipe);
  try{localStorage.setItem(context,JSON.stringify(book));if(cloudEnabled())MorzsaPersistence.capture(book);return true}catch{toast(say('Az előzmény nem menthető ezen az eszközön.','History could not be saved on this device.'));return false}
 }
 function append(message){const t=thread();t.updated=Date.now();t.messages.push({id:crypto.randomUUID(),...message,createdAt:t.updated});if(!t.title&&message.role==='user')t.title=(CraftingModel.receipt(message.text,language)||message.text).slice(0,60);return persist()}
 function canSwitch(){if(busy||saving||pending||preparing||startingTurn){toast(say('Előbb fejezd be a választ vagy kezeld a javaslatot.','Finish the response or review the proposal first.'));return false}return true}
 function selectThread(id){
  sync();if(id===book.active){closePanels();open();return true}if(!canSwitch()||!book.threads.some(t=>t.id===id))return false;
  drafts.set(book.active,{text:draft,attachment,retryAttachment});stopReveal();photoSerial++;book.active=id;expandedRecipes=new Set();recipeDetails=null;cookingView=C.phase(thread())==='guided'?'focus':'full';cookingQuestion=false;const saved=drafts.get(id);draft=saved?.text||'';attachment=saved?.attachment||null;retryAttachment=saved?.retryAttachment||null;error='';failedAnswer='';persist();closePanels();open();if(cloudEnabled())MorzsaPersistence.loadThread(id).catch(()=>toast(say('Az előzmény nem tölthető be.','History could not load.')));return true;
 }
 function goMain(text='',origin=''){composerOrigin=origin;sync();if((busy||saving||pending||preparing)&&page!=='chat')open();if(selectThread(mainThread().id)&&text){draft=text;renderChat();main.querySelector('#companion-input')?.focus()}}
 function ask(text){sync();if(!canSwitch())return false;if(!selectThread(mainThread().id))return false;send(text);return true}
 function askVoice(){sync();if(!canSwitch())return false;if(page!=='chat'&&!selectThread(mainThread().id))return false;voice();return true}
 function newChat(){
  sync();if(!canSwitch())return false;
  if(thread()?.kind!=='recipe'&&!thread()?.archivedAt&&!thread()?.messages.length){craftDrafts.delete(craftKey());window.CraftingRoom?.cleanup();closePanels();open();main.querySelector('#companion-input')?.focus();return true}
  const previous=book;let next;
  try{next=M.startChat(book,crypto.randomUUID(),RecipeRoomModel.recipe)}catch{toast(say('Az előzmények megteltek; folytass egy meglévő beszélgetést.','History is full; continue an existing conversation.'));return false}
  drafts.set(book.active,{text:draft,attachment,retryAttachment});book=next;
  if(!persist()){book=previous;return false}draft='';attachment=null;retryAttachment=null;photoSerial++;expandedRecipes.clear();expandedDays.clear();showPast=false;error='';failedAnswer='';stopReveal();closePanels();open();main.querySelector('#companion-input')?.focus();return true;
 }
 function saveWeeklySchedule(id,rows){if(!canSwitch()||book.active!==id||!thread().weeklyPlan||thread().readOnly)return false;const list=WeeklyPlanModel.recipes(thread().messages),text=WeeklyPlanModel.scheduleMessage(rows),verified=WeeklyPlanModel.schedule([{role:'model',text}],list,thread().weeklyPlan);if(JSON.stringify(rows)!==JSON.stringify(verified)){toast(say('Legfeljebb 24 adag készülhet egyszerre egy receptből. Csökkentsd az adagokat vagy válassz több fogást.','Limit each recipe batch to 24 portions. Reduce portions or use more dishes.'));return false;}const previous=structuredClone(book);if(!append({role:'model',text,recipes:[]})){book=previous;return false}renderChat();toast(say('Heti terv elmentve. A bevásárlólistát külön áttekintheted.','Weekly plan saved. Review the shopping list separately.'));return true}
 function planWeek(settings){sync();if(!canSwitch())return false;if(newChat()===false)return false;if(page!=='chat'||thread()?.kind==='recipe')return false;thread().weeklyPlan=WeeklyPlanModel.settings(settings);thread().title=say('Heti menü · ','Weekly menu · ')+thread().weeklyPlan.week;if(!persist())return false;send(WeeklyPlanModel.prompt(thread().weeklyPlan,language));return true}
 function resumeCooking(){sync();const t=thread()?.kind==='recipe'&&thread().status==='active'?thread():book.threads.filter(t=>t.kind==='recipe'&&t.status==='active').sort((a,b)=>b.updated-a.updated)[0];if(!t){page='recipes';render();window.scrollTo(0,0);return false}if(!selectThread(t.id))return false;if(C.phase(thread())==='guided'){cookingView='focus';renderChat()}return true}
 function activity(){sync();return {cooking:!!book.threads.find(t=>t.kind==='recipe'&&t.status==='active'),current:page==='chat'&&isCooking()?'cooking':page==='shopping'&&window.ShoppingMode?.visible()?'shopping':page==='chat'?'morzsa':null}}
 function askRecipe(r,text,portions){if(!discuss(r,portions))return false;send(text);return true}
 function archiveCurrent(){
  if(!canSwitch()||isCooking())return;const t=thread(),restoring=!!t.archivedAt,current=scope(),id=t.id;
  if(t.readOnly){MorzsaPersistence.archiveShared(id,!restoring).catch(()=>toast(say('Nem sikerült archiválni.','Could not archive.')));return}
  const previous=book,was=t.archivedAt;book=M.archiveThread(book,id,RecipeRoomModel.recipe,!restoring);
  if(!persist()){book=previous;return}closePanels();renderChat();toast(say(restoring?'Visszakerült a beszélgetésekhez.':'Archiválva. Az előzményekben megmarad.',restoring?'Returned to conversations.':'Archived. It remains in history.'));
  if(restoring)return;document.getElementById('history-undo')?.remove();const stamp=book.threads.find(t=>t.id===id)?.archivedAt,notice=document.createElement('div');notice.id='history-undo';notice.className='voice-undo';notice.setAttribute('role','status');notice.innerHTML='<span>'+say('Beszélgetés archiválva','Conversation archived')+'</span><button>'+say('Visszavonás','Undo')+'</button>';document.body.append(notice);const timer=setTimeout(()=>notice.remove(),8000);
  notice.querySelector('button').onclick=()=>{if(!canSwitch()||scope()!==current)return;const live=book.threads.find(t=>t.id===id);if(!live||live.archivedAt!==stamp){notice.remove();return}const old=live.archivedAt;if(was)live.archivedAt=was;else delete live.archivedAt;if(!persist()){live.archivedAt=old;return}clearTimeout(timer);notice.remove();renderChat();toast(say('Archiválás visszavonva.','Archiving undone.'));};
 }

 function discuss(r,portions=window.RecipeRoom?.portionsFor(r)){
  sync();if(!canSwitch())return false;let next;
  try{next=M.startRecipe(book,r,crypto.randomUUID(),RecipeRoomModel.recipe);if(portions)next=M.setPortions(next,next.active,portions,RecipeRoomModel.recipe)}catch{toast(say('Most nem nyitható új receptbeszélgetés.','Cannot open another recipe conversation right now.'));return false}
  drafts.set(book.active,{text:draft,attachment,retryAttachment});book=next;expandedRecipes=new Set();recipeDetails=null;cookingView=C.phase(thread())==='guided'?'focus':'full';cookingQuestion=false;const saved=drafts.get(book.active);draft=saved?.text||'';attachment=saved?.attachment||null;retryAttachment=saved?.retryAttachment||null;photoSerial++;stopReveal();error='';failedAnswer='';persist();window.RecipeLibrary?.save(thread().recipe,RecipeLibrary.isFavourite(thread().recipe),'started').catch(()=>{});window.KitchenIntelligence?.recordRecipe('recipe_started',thread().recipe.title,thread().id);closePanels();open();return true;
 }
 function finishCooking(){
  if(!isCooking()||thread()?.readOnly||!canSwitch())return false;const previous=book,t=thread();if(t.status==='completed')return true;
  book=M.finishRecipe(book,t.id,RecipeRoomModel.recipe,say('Lezárt főzés: ','Cooking session finished: '));if(!persist()){book=previous;return false}window.RecipeLibrary?.save(t.recipe,RecipeLibrary.isFavourite(t.recipe),'completed').catch(()=>{});window.KitchenIntelligence?.recordRecipe('recipe_completed',t.recipe.title,t.id);cookingQuestion=false;renderChat();window.scrollTo(0,0);return true;
 }
 function closePanels(){document.getElementById('companion-history')?.close();document.getElementById('companion-quick')?.close();main.querySelector('.ingredient-inline-actions')?.remove()}
 function open(text=''){page='chat';if(text)draft=text;render();window.scrollTo({top:0,behavior:'instant'});if(text)main.querySelector('#companion-input')?.focus()}
 function mountResume(){
  main.querySelector('.cooking-resume-card')?.remove();
  if(!['overview','chat'].includes(page)||page==='chat'&&(isCooking()||craftState()?.open||thread()?.messages.length))return;
  const active=book.threads.filter(t=>t.kind==='recipe'&&t.status==='active'&&!t.readOnly&&!t.archivedAt&&C.phase(t)!=='completion').sort((a,b)=>b.updated-a.updated);if(!active.length)return;
  const t=active[0],host=document.createElement('aside');host.className='cooking-resume-card';host.setAttribute('data-no-translate','');
  host.innerHTML='<button data-resume-thread>'+ui('chef-hat')+'<span><strong>'+say('Folytasd: ','Continue: ')+esc(t.title)+'</strong><small>'+(C.phase(t)==='preparation'?say('Előkészítés','Preparation'):(t.cookingStep+1)+'/'+t.recipe.steps.length+say('. lépés · ',' steps · ')+esc(RecipeRoomModel.stepTitle(t.recipe,t.cookingStep)))+'</small></span>'+ui('arrow-right')+'</button>'+(active.length>1?'<button class="small-button" data-more-cooking>'+say('További főzések','More cooking sessions')+' · '+(active.length-1)+'</button>':'');
  const anchor=page==='overview'?main.querySelector('.daily-heading'):main.querySelector('#companion-nudge');if(!anchor)return;anchor.after(host);host.querySelector('[data-resume-thread]').onclick=()=>selectThread(t.id);host.querySelector('[data-more-cooking]')?.addEventListener('click',()=>{history();document.querySelector('[data-thread="'+active[1].id+'"]')?.scrollIntoView({block:'center'})});
 }
 function onNavigate(){sync();if(page!=='chat'){window.CraftingRoom?.cleanup();stopReveal();closePanels()}renderHistoryRail();viewport();refreshCookingResume()}
 function labels(o){const d=VoiceModel.defaults(o,state,productUnit);return ({stock_add:say('Készletbe','To pantry'),stock_remove:say('Elfogyott','Used up'),list_set:say('Listára','To list')})[o.action]+(o.action==='list_set'?' · '+d.quantity+' '+d.unit:'')}
 function revision(bucket,name){return household?.active?household.rows?.find(r=>r.bucket===bucket&&r.key===name)?.revision:null}
 const fingerprint=ops=>M.fingerprint(state,ops,revision);
 function receive(output,text,shown='',instant=false){
  if(!VoiceModel.validate(output)||output.answer!==undefined&&typeof output.answer!=='string')throw Error('VOICE_INVALID_RESPONSE');
  const operations=VoiceModel.resolve(output,[...catalog,...state.custom],productEnglish,QuickEntry),recipes=(output.recipes||[]).map(RecipeRoomModel.recipe).filter(Boolean),answer=(output.answer||'').trim(),clarification=(output.clarification||'').trim();
  if(!answer&&!clarification&&!operations.length&&!recipes.length)throw Error('VOICE_EMPTY_RESPONSE');
  if(text===undefined)append({role:'user',text:output.transcript,recipes:[]});
  append({role:'model',text:answer||clarification||(operations.length?say('Így módosítanám. Nézd át, mielőtt mentjük.','Here are the proposed changes. Review before saving.'):say('Hoztam egy receptötletet.','Here is a recipe idea.')),recipes:(output.recipes||[]).map(RecipeRoomModel.recipe).filter(Boolean),...(operations.length?{result:say('Javaslat, nincs mentve.','Proposed, not saved.')}:clarification?{result:say('Pontosítás szükséges.','Clarification needed.')}:{})});
  window.RecipeImages?.enqueue((output.recipes||[]).map(RecipeRoomModel.recipe).filter(Boolean));
  if(CraftingModel.selection(text))for(const r of (output.recipes||[]).map(RecipeRoomModel.recipe).filter(Boolean))saveChatFavourite(r,true);
  pending=operations.length?{operations,output,stamp:fingerprint(operations),thread:book.active,message:thread().messages.length-1}:null;if(!instant)startReveal(shown);
 }
 function requestContext(){return {assistant:true,companion:true,destination:'stock',language,context:{...(window.KitchenIntelligence?.context(book)||{}),...(thread().weeklyPlan?{weeklyPlan:WeeklyPlanModel.settings(thread().weeklyPlan)}:{}),...(book.threads.some(t=>t.cooking?.feedback?.householdFavourite)?{cookingFavourites:book.threads.filter(t=>t.cooking?.feedback?.householdFavourite).slice(0,6).map(t=>t.recipe.title)}:{}),...(window.KitchenMeasures?.enabled()?{noScale:true}:{}),...(isCooking()?{cookingRecipe:RecipePortions.view(thread().recipe,thread().portions),...(RecipePortions.selection(thread().recipe,thread().portions)?{cookingBaseServings:RecipePortions.selection(thread().recipe,thread().portions).base}:{}),cookingStep:thread().cookingStep||0,cookingSession:C.context(thread())}:{}),stock:Object.keys(state.stock).filter(n=>state.stock[n]>0).slice(0,1000),cart:state.cart.slice(0,1000).map(i=>({name:i.name,quantity:i.quantity||1,unit:i.unit||productUnit(i.name)})),uncertain:(PantryReview?.uncertain()||[]).slice(0,1000)},history:M.history(M.currentMessages(thread()),12)}}
 let startingTurn=false,retryRequest=null,pendingSend=null,sendStartedAt=0;
 async function send(value,retry=false,recipeRequestOnly=false){
  sync();const selected=retry?retryAttachment:attachment;const text=String(value).trim()||(selected?say('Mit látsz a képen? Miben segíthet a főzésnél?','What can you see in this photo? How could I use it for cooking?'):'');if(!text||text.length>2000||busy||saving||preparing||thread()?.readOnly||startingTurn)return;
  if(!household?.userId()){draft=text;renderChat();document.getElementById('household-button').click();return}
  if(pending){toast(say('Előbb mentsd vagy vesd el az előző javaslatot.','Save or dismiss the previous proposal first.'));return}
  if(!retry&&!selected&&localCookingCommand(text))return;
  const current=context,id=++serial,tid=book.active;requestController=new AbortController();const controller=requestController;let turn=null,submitted=false;
  stopReveal();resetStream();failedAnswer='';error='';retryRequest=null;pendingSend=retry?null:{text,photo:selected?.photo,attachment:selected};draft='';attachment=null;busy=true;sendStartedAt=performance.now();startingTurn=!!cloudEnabled();quietUntil=Date.now()+600000;renderChat();scrollEnd();
  try{
   // Give the sending bubble and Stop control a paint before history/network work.
   await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));controller.signal.throwIfAborted();
   if(cloudEnabled()){persist();turn=await MorzsaPersistence.beginTurn(tid,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])})}
   if(current!==scope()||id!==serial||tid!==book.active)return;controller.signal.throwIfAborted();startingTurn=false;

  if(craftState())craftState().open=false;window.CraftingRoom?.cleanup();
  stopReveal();const recipeOnly=!household.voiceCommandStream&&!selected&&(retry?thread().messages.at(-1)?.provider==='recipes':recipeRequestOnly);const payload=requestContext();if(retry)payload.history=M.history(M.currentMessages(thread()).slice(0,-1),12);else append({role:'user',text,recipes:[],...(selected?{photo:selected.photo}:{}),...(recipeOnly?{provider:'recipes'}:{})});
  if(selected&&cloudEnabled()){const last=thread().messages.at(-1);MorzsaPersistence.queuePhoto(last.id,selected.image);persist()}
  submitted=true;pendingSend=null;retryAttachment=selected;renderChat();scrollEnd();
  if(selected){const status=await household.voiceStatus();if(!status.supportsImages)throw Error('PHOTO_SETUP');if(current!==scope()||id!==serial)return}let output;if(household.voiceCommandStream){output=await household.voiceCommandStream({...payload,text,...(selected?{image:selected.image}:{})},partial=>{if(current===scope()&&id===serial){streamText=partial;paintStream()}},controller.signal)}else if(recipeOnly){const pantry=recipeRequest();const r=await household.recipeIdeas({conversation:true,text,history:payload.history.map(m=>({...m,text:m.text.slice(0,4000)})),names:pantry.names.slice(0,200),uncertain:pantry.uncertain.slice(0,200),language,preferences:{quick:false,mood:'any'}});if(typeof r.answer!=='string'||!Array.isArray(r.recipes)||r.recipes.some(x=>!RecipeRoomModel.recipe(x)))throw Error('VOICE_INVALID_RESPONSE');output={transcript:text,answer:r.answer,recipes:r.recipes,clarification:'',operations:[]}}else output=await household.voiceCommand({...payload,text,...(selected?{image:selected.image}:{})});if(current!==scope()||id!==serial)return;if(controller.signal.aborted)throw Error('ABORTED');receive(output,text,streamVisible,true);resetStream();retryAttachment=null}
  catch(e){if(current===scope()&&id===serial){if(!submitted)retryRequest={text,retry,recipeRequestOnly};failedAnswer=streamVisible;error=controller.signal.aborted?say('Megállítottad a választ. Újrapróbálhatod vagy írhatsz mást.','Response stopped. Retry or send a new message.'):!submitted?say(/Another device/.test(e.message)?'Morzsa már válaszol egy másik eszközödön.':'Az előzmény még mentésre vár. Próbáld újra.',/Another device/.test(e.message)?'Morzsa is answering on another device.':'History is still syncing. Try again.'):e.message==='PHOTO_SETUP'?say('A képfelismeréshez még frissíteni kell a Morzsa AI-szolgáltatását. A fotót megőriztem az újrapróbáláshoz.','Morzsa’s AI service needs an update for photos. Your photo is kept for retry.'):voiceError(Error(({AI_DAILY_LIMIT:'VOICE_DAILY_LIMIT',AI_SIGN_IN_REQUIRED:'VOICE_SIGN_IN_REQUIRED',AI_NOT_CONFIGURED:'VOICE_SETUP_REQUIRED',AI_SETUP_REQUIRED:'VOICE_SETUP_REQUIRED'})[e.message]||e.message))}}
  finally{if(current===scope()&&id===serial){if(!submitted){draft=draft||text;attachment=attachment||selected}pendingSend=null;busy=false;startingTurn=false;resetStream();requestController=null;renderChat();scrollEnd()}if(turn){if(submitted)window.MorzsaPersistence?.finishTurn(tid,turn);else window.MorzsaPersistence?.endTurn(tid,turn)}}
 }
 async function voice(){
  sync();if(busy||saving||pending||thread()?.readOnly)return;
  const current=context,tid=book.active;let voiceTurn=null;
  if(cloudEnabled()&&window.AIMode?.isPlus()){try{voiceTurn=await MorzsaPersistence.beginTurn(tid);setTimeout(()=>MorzsaPersistence.endTurn(tid,voiceTurn),115000)}catch{toast(say('A beszélgetés még mentésre vár vagy másik eszközön aktív.','The conversation is syncing or active on another device.'));return}if(current!==scope()||tid!==book.active)return}
  if(window.AIMode?.isPlus()&&window.MorzsaRealtime){
   const valid=()=>current===scope()&&tid===book.active;
   const messages=()=>{const parent=isCooking()?book.threads.find(t=>t.id===thread().parentId):null;return [...(parent?.messages||[]),...thread().messages]};
   MorzsaRealtime.open({valid,onEnd:reason=>{if(reason!=='retry')MorzsaPersistence.endTurn(tid,voiceTurn)},context:()=>({...requestContext(),history:M.voiceHistory(messages())}),history:args=>valid()?M.voicePage(messages(),args):{error:'Conversation changed'},onUser:text=>{if(!valid())return;append({role:'user',text:text.slice(0,3000),recipes:[]});renderChat();scrollEnd()},onAssistant:text=>{if(!valid())return;append({role:'model',text:text.slice(0,5000),recipes:[]});renderChat();scrollEnd()},tools:{
    propose:(operations,transcript)=>{if(!valid()||pending||saving||busy)return {proposed:false,reason:'An earlier proposal is waiting for review.'};const output={transcript,answer:say('Nézd át, majd mondd: „mentheted”.','Review, then say “save changes”.'),clarification:'',operations,recipes:[]};if(!VoiceModel.validate(output))return {proposed:false};receive(output,'');renderChat();scrollEnd();return {proposed:true,items:pending?.operations.map(o=>({name:displayName(o.name),action:labels(o),recognized:o.confirmed}))||[]}},
    confirm:async()=>{if(!valid()||!pending)return {saved:false,reason:'No proposal to save.'};const saved=await apply();return {saved:saved===true,reason:saved?'Saved.':'Review the proposal in the chat; data may have changed or a product may need clarification.'}},
    recipe:async request=>{if(!valid()||pending||busy||saving)return {created:false};await send(request);if(!valid())return {created:false};return {created:!error,recipes:thread().messages.at(-1)?.recipes||[],error:error||undefined}},
    step:index=>{if(!valid()||!isCooking()||!Number.isInteger(index)||index<0||index>=thread().recipe.steps.length)return {changed:false};if(!jumpCookingStep(index))return {changed:false};return {changed:true,step:index,title:thread().recipe.stepTitles?.[index],text:thread().recipe.steps[index]}},
    ingredients:()=>{if(!valid()||!isCooking())return {shown:false};showCookingIngredients();return {shown:true,ingredients:RecipePortions.view(thread().recipe,thread().portions).ingredients}},
    advance:()=>{if(!valid()||!isCooking()||C.phase(thread())!=='guided'||thread().status!=='active')return {changed:false};if(!completeCookingStep())return {changed:false};return {changed:true,step:cookingStep(),phase:C.phase(thread()),text:thread().recipe.steps[cookingStep()]}},
    repeat:()=>valid()&&isCooking()?{step:cookingStep(),title:RecipeRoomModel.stepTitle(thread().recipe,cookingStep()),text:thread().recipe.steps[cookingStep()]}:{error:'No cooking session'},
    timer:(minutes,label)=>valid()&&isCooking()?startCookingTimer(minutes,label):{started:false,reason:'Open a cooking session first.'},
   }});return;
  }
  openVoiceCommand('voice','',{history:M.history(M.currentMessages(thread())),...(isCooking()?{cookingRecipe:RecipePortions.view(thread().recipe,thread().portions),...(RecipePortions.selection(thread().recipe,thread().portions)?{cookingBaseServings:RecipePortions.selection(thread().recipe,thread().portions).base}:{}),cookingStep:thread().cookingStep||0,cookingSession:C.context(thread())}:{}),onOutput:output=>{if(current!==scope()||tid!==book.active)return;try{if(localCookingCommand(output.transcript))return;receive(output);quietUntil=Date.now()+600000;open();scrollEnd()}catch(e){toast(voiceError(e))}}});
 }
 function markResult(result,operations=[]){if(!pending)return;const message=thread().messages[pending.message]||thread().messages.at(-1);message.result=(result+(operations.length?' '+operations.slice(0,4).map(o=>displayName(o.name)+' · '+labels(o)).join('; ')+(operations.length>4?say(' és további ',' and ')+(operations.length-4)+say(' módosítás.',' more changes.'):''):'' )).slice(0,500);pending=null;persist()}
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
   markResult(plan.changes.length?say('Elmentve.','Saved.'):say('Már így szerepel.','Already up to date.'),p.operations.filter(o=>plan.changes.some(c=>c.key===o.name)));showVoiceUndo(plan.changes,undoContext);return true;
  }catch{toast(say('Nem sikerült menteni. A javaslat megmaradt.','Could not save. Your proposal is kept.'))}
  finally{saving=false;if(current===scope())renderChat()}
 }
 function editProposal(){
  if(!pending||saving)return;const current=context,p=pending;let baseline=JSON.parse(JSON.stringify(state)),baseRows=JSON.parse(JSON.stringify(household?.rows||[]));
  openVoiceCommand('text','',{output:p.output,beforeApply:ops=>{if(current!==scope())return false;const stamp=fingerprint(p.operations),changed=stamp!==p.stamp||fingerprint(ops)!==M.fingerprint(baseline,ops,(b,n)=>household?.active?baseRows.find(r=>r.bucket===b&&r.key===n)?.revision:null);if(changed){p.stamp=stamp;baseline=JSON.parse(JSON.stringify(state));baseRows=JSON.parse(JSON.stringify(household?.rows||[]));return false}return true},onSaved:ops=>{if(current!==scope()||pending!==p)return;removed(ops.filter(o=>o.action==='stock_remove').map(o=>o.name));markResult(say('Elmentve.','Saved.'),ops);renderChat()}});
 }
 const savingFavourites=new Set();
 async function saveChatFavourite(r,keepDiscovery=false){
  const key=RecipeShopping.key(r);if(savingFavourites.has(key))return;savingFavourites.add(key);const current=context,tid=book.active,y=scrollY;renderChat();window.scrollTo(0,y);
  try{if(household?.userId()&&household?.dataRpc)await RecipeLibrary.save(r,keepDiscovery?RecipeRoom.isFavourite(r):!RecipeRoom.isFavourite(r));else if(keepDiscovery||!RecipeRoom.toggleFavourite(r))return;if(!keepDiscovery&&current===scope()&&tid===book.active)toast(say(RecipeRoom.isFavourite(r)?'Recept elmentve a kedvencek közé.':'Kivéve a kedvencek közül.',RecipeRoom.isFavourite(r)?'Recipe saved to favourites.':'Removed from favourites.'))}
  catch{if(current===scope())toast(say('Nem sikerült menteni. Próbáld újra.','Could not save. Try again.'))}
  finally{savingFavourites.delete(key);if(current===scope()&&tid===book.active&&page==='chat'){const y=scrollY;renderChat();window.scrollTo(0,y)}}
 }
 function recipeCard(r,index,craftNames=null,completed=false){
  const availability=KitchenModel.recipeChoice(r,state.stock,window.PantryReview?.uncertain()||[],craftResolve),picked=craftNames?new Set(craftNames.map(craftResolve)):null,count=picked?new Set(r.ingredients.map(i=>craftResolve(i.name)).filter(n=>picked.has(n))).size:0;
  const detail=[availability.out.length?say('Hiányzik: ','Missing: ')+availability.out.map(displayName).join(', '):'',availability.unknown.length?say('Ellenőrizd: ','Check: ')+availability.unknown.map(displayName).join(', '):''].filter(Boolean).join(' · ');
  return '<article class="companion-recipe" '+(picked?'data-craft-result':'')+'><div data-generated-recipe="'+index+'"></div>'+(completed||picked?'<span class="ai-content-label">'+esc(completed?say('Elkészített recept','Cooked recipe'):say('A táladból · '+count+'/'+picked.size+' alapanyag','From your bowl · '+count+'/'+picked.size+' ingredients'))+'</span>':'')+'<p class="companion-recipe-meta">'+ui('clock')+r.minutes+say(' perc',' min')+(r.servings?' · '+(completed?say('Alaprecept: ','Base recipe: '):'')+r.servings+say(' adag',' servings'):'')+'</p><h3>'+esc(r.title)+'</h3><p>'+esc(r.summary)+'</p>'+RecipeRoom.coverageMarkup(r)+(detail?'<p class="companion-recipe-needs">'+esc(detail)+'</p>':'')+'<div class="companion-actions"><button class="recipe-chat-cook" data-view-recipe="'+index+'">'+say('Megnézem','View recipe')+ui('arrow-right')+'</button><button class="recipe-chat-icon" data-recipe-favourite="'+index+'" '+(savingFavourites.has(RecipeShopping.key(r))?'disabled':'')+' aria-pressed="'+!!window.RecipeRoom?.isFavourite(r)+'" aria-label="'+esc(say('Kedvenc: ','Favourite: ')+r.title)+'">'+ui('heart')+'</button></div>'+((availability.out.length||availability.unknown.length||availability.low.length)?'<button class="companion-recipe-shopping" data-recipe-shopping="'+index+'">'+ui('shopping-cart')+say('Hozzávalók és bevásárlás','Ingredients & shopping')+'</button>':'')+(expandedRecipes.has(RecipeShopping.key(r))?'<div class="inline-recipe" data-inline-recipe="'+index+'"></div>':'')+'</article>';
 }

 const timerEditors=new Map();
 const timerKey=()=>JSON.stringify([context,book.active,cookingStep()]);
 function rememberTimerEditor(){
  const el=main.querySelector('[data-timer-editor]'),input=el?.querySelector('input');if(!el||!input)return null;
  timerEditors.set(el.dataset.timerEditor,{open:el.open,value:input.value});if(timerEditors.size>100)timerEditors.delete(timerEditors.keys().next().value);
  return document.activeElement===input?{key:el.dataset.timerEditor,scroll:scrollY}:null;
 }
 let cookingQuestionPosition=0;const feedbackDrafts=new Map(),consumptionOpen=new Set(),consumptionChoices=new Map();
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
 function messageMarkup(m,i){
  let prior=i-1;while(prior>=0&&thread().messages[prior]?.role!=='user')prior--;
  const completed=m.role==='model'&&/^(Lezárt főzés:|Cooking session finished:)/.test(m.text);
  const chosen=m.role==='model'&&!completed?CraftingModel.selection(thread().messages[prior]?.text):null;
  return '<article class="companion-message '+m.role+'">'+(m.role==='model'?'<div class="companion-speaker"><img src="assets/brands/morzsa.svg" width="20" height="20" alt="">Morzsa</div>':'')+(m.photo?'<img class="companion-user-photo" src="'+m.photo+'" alt="'+say('Beküldött fotó','Submitted photo')+'" width="180" height="140">':'')+answerText(m,i)+(chosen&&m.recipes?.length?'<p class="craft-discovery-receipt">'+ui('sparkles')+say(m.recipes.length+' receptötlet a táladból · a Receptek között is megtalálod.',m.recipes.length+' ideas from your bowl · also in Recipes.')+'</p>':'')+(m.recipes||[]).map(r=>{const index=cards.push(r)-1;return recipeCard(r,index,chosen?.map(i=>i.name),completed)}).join('')+(chosen&&!m.recipes?.length?'<button class="small-button" data-recraft="'+prior+'">'+say('Módosítom a hozzávalókat','Change ingredients')+'</button>':'')+(m.result?'<small class="companion-result '+(m.result.startsWith('Elmentve.')||m.result.startsWith('Saved.')?'action-receipt':'')+'">'+esc(m.result)+'</small>':'')+'</article>';
 }

 function renderMessages(messages,welcome){
  if(thread().kind!=='main')return messages.length?messages.map(messageMarkup).join(''):welcome;
  const groups=M.dayGroups(messages),past=groups.filter(g=>!g.current),today=groups.find(g=>g.current);
  return (past.length?'<details class="companion-past" data-past '+(showPast?'open':'')+'><summary>'+say('Korábbi beszélgetések','Earlier conversations')+'<small>'+past.length+say(' előzmény',' entries')+'</small></summary>'+past.map(g=>'<details class="companion-day" data-day="'+g.key+'" '+(expandedDays.has(g.key)?'open':'')+'><summary><span>'+esc(dayLabel(g))+'</span><small>'+g.items.length+say(' üzenet',' messages')+'</small></summary>'+(expandedDays.has(g.key)?'<div class="companion-day-content">'+g.items.map(({message,index})=>messageMarkup(message,index)).join('')+'</div>':'')+'</details>').join('')+'<p class="companion-caption">'+say('Az előzményeket itt visszanézheted; Morzsa a mai beszélgetést folytatja.','Revisit earlier messages here; Morzsa continues today’s conversation.')+'</p></details>':'')+'<div class="companion-day-divider">'+say('Ma','Today')+'</div>'+(today?today.items.map(({message,index})=>messageMarkup(message,index)).join(''):welcome);
 }
 const cookingStep=()=>thread()?.cookingStep||0;
 const kitchenBowl='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 11h18c0 6-4 9-9 9s-9-3-9-9ZM7 20h10M7 3v4m5-5v5m5-4v4"/></svg>';
 function localCookingCommand(text){
  if(!isCooking()||thread().readOnly||C.phase(thread())!=='guided'||pending||busy||saving)return false;
  const action=C.voiceAction(text),minutes=C.voiceMinutes(text);if(!['advance','repeat','previous'].includes(action)&&!minutes)return false;
  if(action==='advance')completeCookingStep();else if(action==='previous')jumpCookingStep(Math.max(0,cookingStep()-1));else if(minutes)startCookingTimer(minutes,RecipeRoomModel.stepTitle(thread().recipe,cookingStep()));
  append({role:'user',text,recipes:[]});append({role:'model',text:action==='repeat'?thread().recipe.steps[cookingStep()]:minutes?minutes+say(' perces időzítő elindítva.',' minute timer started.'):C.phase(thread())==='completion'?say('Elkészült a fogás. Jó étvágyat!','Dish finished. Enjoy!'):say('Most ez következik: ','Current step: ')+RecipeRoomModel.stepTitle(thread().recipe,cookingStep()),recipes:[]});renderChat();return true;
 }
 function changeCooking(update){
  sync();if(!isCooking()||thread().readOnly||!canSwitch())return false;const old=book;
  book=structuredClone(book);const t=thread();t.cooking=C.normalize(update(C.normalize(t.cooking,t.recipe,t.status)),t.recipe,t.status);t.updated=Date.now();
  if(!persist()){book=old;return false}renderChat();return true;
 }
 function beginCooking(){if(changeCooking(()=>C.begin(thread()))){cookingView='focus';cookingQuestion=false;recipeDetails=false;renderChat();window.scrollTo(0,0)}}
 function startCookingTimer(minutes,label,step=cookingStep()){
  const id=crypto.randomUUID();try{if(!changeCooking(()=>C.addTimer(thread(),{id,minutes,label,step})))return {started:false};toast(label+' · '+minutes+say(' perces időzítő elindítva',' minute timer started'));return {started:true,timerId:id,minutes,label}}catch{toast(say('Most nem indítható új időzítő.','Cannot start another timer right now.'));return {started:false}}
 }
 const notifiedTimers=new Set();
 function tickCookingTimers(){
  if(document.hidden)return;sync();
  for(const t of book.threads.filter(t=>t.kind==='recipe'))for(const timer of C.normalize(t.cooking,t.recipe,t.status).timers.filter(x=>!x.cancelled&&!x.acknowledged)){
   const seconds=C.remaining(timer),out=main.querySelector('[data-timer-time="'+timer.id+'"]');if(out){const text=seconds?C.clock(seconds):say('Letelt!','Time is up!');if(out.textContent!==text)out.textContent=text;out.closest('[data-timer-row]')?.classList.toggle('is-due',seconds===0)}
   if(!seconds&&!notifiedTimers.has(context+'|'+timer.id)){notifiedTimers.add(context+'|'+timer.id);toast(timer.label+' · '+say('Letelt az idő!','Time is up!'))}
  }
 }
 setInterval(tickCookingTimers,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickCookingTimers()});
 function cookingDock(){if(!isCooking())return '';const phase=C.phase(thread()),disabled=busy||saving||pending||preparing||thread().readOnly;return '<div class="cooking-task-dock">'+(cookingQuestion?'<button data-close-question>'+say('Vissza a főzéshez','Back to cooking')+'</button>':'<div class="cooking-dock-tools"><button data-cooking-ingredients>'+kitchenBowl+say('Hozzávalók','Ingredients')+'</button><button data-open-cooking-question>'+ui('message-circle')+say('Morzsa','Morzsa')+'</button><button data-cooking-voice aria-label="'+say('Hangbeszélgetés','Voice conversation')+'">'+ui('mic')+'</button></div>')+(!cookingQuestion?(phase==='guided'&&cookingView==='focus'?'<button class="primary" data-complete-step '+(disabled?'disabled':'')+'>'+say(cookingStep()===thread().recipe.steps.length-1?'Elkészült!':'Kész, következő',cookingStep()===thread().recipe.steps.length-1?'Finished!':'Done, next')+'</button>':phase==='preparation'?'<button class="primary" data-begin-cooking '+(disabled?'disabled':'')+'>'+say('Főzés kezdése','Start cooking')+'</button>':phase==='completion'?'<button class="primary" data-main>'+say('Kész, befejezem','Done, finish')+'</button>':'<button class="primary" data-cooking-view="focus">'+say('Vissza a '+(cookingStep()+1)+'. lépéshez','Back to step '+(cookingStep()+1))+'</button>'):'')+'</div>'}
 function cookingHeader(){
  if(!isCooking()||C.phase(thread())==='completion')return '';
  if(C.phase(thread())==='guided'&&cookingView==='focus')return '<section class="cooking-hero cooking-compact-title"><p>'+say('Vezetett főzés','Guided cooking')+'</p><h1>'+esc(thread().title)+'</h1></section>';
  return '<section class="cooking-hero"><div id="cooking-cover" aria-label="'+esc(thread().recipe.title)+'"></div><div class="companion-cooking-focus"><div><small>'+say(thread().status==='completed'?'Lezárt főzés':'Főzzünk együtt',thread().status==='completed'?'Finished cooking':'Let’s cook together')+' · '+thread().recipe.minutes+say(' perc',' min')+'</small><h1>'+esc(thread().title)+'</h1></div>'+(thread().status==='active'?'<button data-main>'+say('Később folytatom','Resume later')+'</button>':'<button data-cook-again>'+say('Újra megfőzöm','Cook again')+'</button>')+'</div><div class="cooking-export"><button data-cooking-share>'+ui('share-2')+say('Megosztás','Share')+'</button><button data-cooking-download>'+ui('download')+say('Letöltés','Download')+'</button></div>'+RecipePortions.controls(thread().recipe,thread().portions,language,thread().readOnly||busy||saving||pending||preparing)+'</section>';
 }
 function cookingGuide(){
  if(!isCooking())return '';const opts={esc,say,ui,stock:state.stock,resolve:n=>QuickEntry.match(n,[...catalog,...state.custom],productEnglish)||n,favourite:!!window.RecipeRoom?.isFavourite(thread().recipe),feedback:feedbackDrafts.get(book.active),consumptionOpen:consumptionOpen.has(book.active),usedUp:consumptionChoices.get(book.active)||[]},phase=C.phase(thread()),view=RecipePortions.view(thread().recipe,thread().portions);
  if(phase==='preparation')return CookingUI.preparation(thread(),view,opts);
  if(phase==='completion')return CookingUI.timers(thread(),opts)+CookingUI.completion(thread(),opts);
  const r=view,step=cookingStep(),done=thread().completedSteps||[],disabled=busy||saving||pending||preparing;
  const outline='<details class="cooking-outline"><summary>'+say('A recept lépései','Recipe steps')+'<small>'+done.length+'/'+r.steps.length+say(' elkészült',' complete')+'</small></summary><ol>'+r.steps.map((_,i)=>'<li><button data-jump-step="'+i+'" aria-current="'+(i===step?'step':'false')+'" '+(disabled?'disabled':'')+'><span aria-hidden="true">'+(done.includes(i)?'✓':i+1)+'</span>'+esc(RecipeRoomModel.stepTitle(r,i))+'</button></li>').join('')+'</ol></details>';
  return '<section class="cooking-guide" data-method-view="'+cookingView+'" aria-label="'+say('A teljes recept','Complete recipe')+'"><p class="cooking-summary">'+esc(r.summary)+'</p><div class="cooking-view-toggle" role="group" aria-label="'+say('Receptnézet','Recipe view')+'"><button data-cooking-view="full" aria-pressed="'+(cookingView==='full')+'">'+say('Teljes recept','Full recipe')+'</button><button data-cooking-view="focus" aria-pressed="'+(cookingView==='focus')+'">'+ui('chef-hat')+say('Fókusz mód','Focus mode')+'</button></div>'+CookingUI.timers(thread(),{esc,say})+'<progress class="cooking-progress" value="'+done.length+'" max="'+r.steps.length+'" aria-label="'+say('Elkészült lépések','Completed steps')+'"></progress><details class="cooking-timer-tools" data-timer-editor="'+esc(timerKey())+'" '+(timerEditors.get(timerKey())?.open?'open':'')+'><summary>'+ui('clock')+say('Időzítő hozzáadása','Add a timer')+'</summary><form class="cooking-custom-timer" data-custom-timer><label>'+say('Időzítő','Timer')+'<input name="minutes" type="number" min="1" max="120" value="'+esc(timerEditors.get(timerKey())?.value??'5')+'" aria-label="'+say('Időzítő percben','Timer minutes')+'"></label><button type="submit">'+say('Indítás','Start')+'</button></form></details><div class="cooking-method-heading"><h2>'+say(cookingView==='full'?'Elkészítés':(step+1)+'. lépés / '+r.steps.length,cookingView==='full'?'Method':'Step '+(step+1)+' of '+r.steps.length)+'</h2><small>'+done.length+'/'+r.steps.length+say(' elkészült',' complete')+'</small></div><div class="cooking-flow"><ol class="cooking-steps">'+r.steps.map((text,i)=>'<li class="cooking-step '+(step===i?'is-current':'')+'" id="cooking-step-'+i+'" data-cooking-step="'+i+'" tabindex="-1" '+(cookingView==='focus'&&step!==i?'hidden':step===i?'aria-current="step"':'')+'><div><h3><span class="recipe-step-index">'+(i+1)+'</span>'+esc(RecipeRoomModel.stepTitle(r,i))+'</h3><div data-cooking-image="'+i+'"></div>'+CookingUI.instructions(text,{esc,say,format:ingredientText})+C.cues(text).map(c=>'<button class="cooking-timer-start" data-timer-minutes="'+c.minutes+'" data-timer-step="'+i+'">'+ui('clock')+esc(c.label)+say(' · Időzítő',' · Start timer')+'</button>').join('')+(i===step?'<div class="cooking-step-navigation"><button data-step-prev '+(disabled||step===0?'disabled':'')+'>'+say('← Előző lépés','← Previous step')+'</button></div>':'')+(i===step&&thread().status==='active'?'<button class="cooking-complete" data-complete-step '+(disabled?'disabled':'')+'>'+say(i===r.steps.length-1?'Elkészült a fogás ✓':'Elkészültem, tovább →',i===r.steps.length-1?'Dish finished ✓':'Done, next →')+'</button>':'')+(done.includes(i)?'<small class="cooking-step-completed">'+say('✓ Ezt már késznek jelölted','✓ You marked this step complete')+'</small>':'')+'</div></li>').join('')+'</ol>'+outline+'</div></section>';
 }
 function showCookingIngredients(){
  sync();if(!isCooking())return;
  const id=book.active,context=voiceContext(),r=thread().recipe;
  RecipeIngredientsPanel.open(r,{portions:thread().portions,readOnly:thread().readOnly,valid:()=>book.active===id&&voiceContext()===context&&page==='chat'&&isCooking()});
 }
 function mountCookingImages(){
  if(!isCooking())return;const r=thread().recipe;
  main.querySelectorAll('[data-cooking-image]').forEach(host=>{const i=Number(host.dataset.cookingImage);if(host.closest('[hidden]'))return;window.RecipeImages?.mount(host,r,i,{autoCreate:true})});
 }
 function jumpCookingStep(index){
  sync();if(!isCooking()||thread().readOnly||busy||saving||pending||preparing)return false;const previous=book;
  try{book=M.setCookingStep(book,book.active,index,RecipeRoomModel.recipe)}catch{return false}
  if(!persist()){book=previous;return false}if(page!=='chat')open();
  renderChat();
  mountCookingImages();const target=main.querySelector('#cooking-step-'+index);target?.focus({preventScroll:true});target?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return true;
 }
 function completeCookingStep(){
  sync();if(!isCooking()||thread()?.readOnly||C.phase(thread())!=='guided'||!canSwitch())return false;const previous=book,index=cookingStep();
  try{book=M.completeCookingStep(book,book.active,index,RecipeRoomModel.recipe)}catch{return false}
  if(!persist()){book=previous;return false}
  if(index===thread().recipe.steps.length-1)return finishCooking();renderChat();main.querySelector('#cooking-step-'+cookingStep())?.scrollIntoView({block:'start',behavior:'smooth'});return true;
 }
 function changePortions(value){
  if(!isCooking()||thread().readOnly||!canSwitch())return;const previous=book;
  try{book=M.setPortions(book,book.active,value,RecipeRoomModel.recipe)}catch{return}
  if(!persist()){book=previous;return}const y=scrollY;renderChat();window.scrollTo(0,y);
 }
 function bindCookingControls(){
  main.querySelector('[data-timer-editor]')?.addEventListener('toggle',e=>{if(e.target.isConnected)rememberTimerEditor()});main.querySelector('[data-custom-timer] input')?.addEventListener('input',rememberTimerEditor);
  main.querySelector('[data-custom-timer]')?.addEventListener('submit',e=>{e.preventDefault();startCookingTimer(Number(new FormData(e.target).get('minutes')),RecipeRoomModel.stepTitle(thread().recipe,cookingStep()))});
  main.querySelectorAll('[data-begin-cooking]').forEach(b=>b.addEventListener('click',beginCooking));
  main.querySelectorAll('[data-timer-minutes]').forEach(b=>b.onclick=()=>startCookingTimer(Number(b.dataset.timerMinutes),RecipeRoomModel.stepTitle(thread().recipe,Number(b.dataset.timerStep)),Number(b.dataset.timerStep)));
  main.querySelectorAll('[data-timer-stop]').forEach(b=>b.onclick=()=>changeCooking(c=>C.timerAction({...thread(),cooking:c},b.dataset.timerStop,'cancel')));
  const feedbackForm=main.querySelector('[data-cooking-feedback]');feedbackForm?.addEventListener('input',()=>{const data=new FormData(feedbackForm);feedbackDrafts.set(book.active,{rating:Number(data.get('cooking-rating'))||undefined,notes:String(data.get('notes')||''),householdFavourite:data.get('householdFavourite')==='on'})});
  main.querySelector('.cooking-consumption summary')?.addEventListener('click',e=>{e.preventDefault();const d=e.currentTarget.parentElement;d.open=!d.open;d.open?consumptionOpen.add(book.active):consumptionOpen.delete(book.active)});
  main.querySelector('.cooking-consumption')?.addEventListener('toggle',e=>{if(e.target.isConnected)e.target.open?consumptionOpen.add(book.active):consumptionOpen.delete(book.active)});
  main.querySelectorAll('[name="used-up"]').forEach(x=>x.onchange=()=>consumptionChoices.set(book.active,[...main.querySelectorAll('[name="used-up"]:checked')].map(i=>i.value)));
  main.querySelector('[data-cooking-feedback]')?.addEventListener('submit',e=>{e.preventDefault();const form=e.target,data=new FormData(form);feedbackDrafts.delete(book.active);if(changeCooking(c=>({...c,feedback:{rating:Number(data.get('cooking-rating'))||undefined,notes:String(data.get('notes')||'').slice(0,1000),householdFavourite:data.get('householdFavourite')==='on'}})))main.querySelector('[data-feedback-saved]').textContent=say('Elmentve.','Saved.');});
  main.querySelector('[data-completion-favourite]')?.addEventListener('click',()=>{RecipeRoom.toggleFavourite(thread().recipe);renderChat()});
  main.querySelector('[data-consumption-review]')?.addEventListener('click',()=>{const names=[...main.querySelectorAll('[name="used-up"]:checked')].map(x=>x.value);if(!names.length){toast(say('Jelöld, amiből semmi nem maradt.','Select what is completely gone.'));return}receive({transcript:say('Ezek elfogytak: ','These ran out: ')+names.join(', '),answer:say('Ezeket venném ki a készletből. Mentsd, ha valóban elfogytak.','I would remove these from your pantry. Save if they are completely gone.'),clarification:'',recipes:[],operations:names.map(name=>({action:'stock_remove',name,quantity:null,unit:null}))});cookingQuestion=true;renderChat();scrollEnd()});
  if(isCooking()&&main.querySelector('.cooking-hero'))RecipePortions.bind(main.querySelector('.cooking-hero'),thread().recipe,thread().portions,changePortions);
  main.querySelectorAll('[data-cooking-view]').forEach(b=>b.onclick=()=>{cookingView=b.dataset.cookingView;cookingQuestion=false;renderChat();if(cookingView==='focus')main.querySelector('#cooking-step-'+cookingStep())?.scrollIntoView({block:'center',behavior:'smooth'})});
  main.querySelector('[data-cooking-share]')?.addEventListener('click',()=>RecipeRoom.exportRecipe(thread().recipe,'share',thread().portions));
  main.querySelector('[data-cooking-download]')?.addEventListener('click',()=>RecipeRoom.exportRecipe(thread().recipe,'download',thread().portions));
  main.querySelectorAll('[data-complete-step]').forEach(b=>b.addEventListener('click',completeCookingStep));
  main.querySelectorAll('[data-cooking-ingredients]').forEach(b=>b.addEventListener('click',showCookingIngredients));
  main.querySelectorAll('[data-step-prev]').forEach(b=>b.onclick=()=>jumpCookingStep(cookingStep()-1));main.querySelector('[data-step-next]')?.addEventListener('click',()=>jumpCookingStep(cookingStep()+1));
  main.querySelector('[data-step-select]')?.addEventListener('change',e=>jumpCookingStep(Number(e.target.value)));
  main.querySelectorAll('[data-jump-step]').forEach(b=>b.onclick=()=>jumpCookingStep(Number(b.dataset.jumpStep)));
 }
 function refreshCookingResume(){
  let el=document.getElementById('cooking-resume');if(!el){el=document.createElement('aside');el.id='cooking-resume';el.setAttribute('data-no-translate','');document.body.append(el)}
  const show=page!=='chat'&&page!=='recipes'&&isCooking()&&thread().status==='active';el.hidden=!show;if(!show)return;
  el.innerHTML='<button data-resume-cooking>'+kitchenBowl+'<span>'+esc(thread().title)+'<small>'+say((cookingStep()+1)+'. lépés','Step '+(cookingStep()+1))+'</small></span></button><button data-resume-ingredients>'+say('Hozzávalók','Ingredients')+'</button>';
  el.querySelector('[data-resume-cooking]').onclick=()=>jumpCookingStep(cookingStep());el.querySelector('[data-resume-ingredients]').onclick=showCookingIngredients;
 }
 function mountAIMode(){
  const mic=main.querySelector('[data-mic]');if(mic&&window.AIMode?.isPlus())mic.setAttribute('aria-label',say('Hangbeszélgetés Morzsával','Voice conversation with Morzsa'));
 }
 function renderChat(){
  if(page!=='chat')return;const timerFocus=rememberTimerEditor();sync();window.CraftingRoom?.cleanup();document.querySelector('.companion-header-history')?.setAttribute('aria-label',say('Beszélgetéstörténet','Conversation history'));cards=[];renderedDay=M.dayKey(Date.now());const messages=thread().messages;
  const welcome=craftState()?.open&&!isCooking()?'':isCooking()?'<p class="cooking-chat-hint">'+say('Kérdezz nyugodtan az aktuális lépésről, helyettesítésről vagy adagokról.','Ask about the current step, substitutions or servings.')+'</p>':'<div class="companion-welcome"><img src="assets/illustrations/morzsa-mascot.webp" width="90" height="90" alt=""><div class="workspace-welcome-copy"><h1>'+say('Mit szeretnél ma megoldani?','What would you like help with today?')+'</h1><p>'+say('Ötleteljünk, főzzünk, vagy mondd el, mi változott otthon.','Let’s cook, find an idea, or catch up on what changed at home.')+'</p></div><div class="companion-starters"><button data-prompt="surprise"><img src="assets/ui/sparkles.svg" alt="" width="22" height="22">'+say('Lepj meg','Surprise me')+'</button><button data-open-craft><img src="assets/ui/chef-hat.svg" alt="" width="22" height="22">'+say('Kotyvasszunk','Mix & discover')+'</button><button data-prompt="familiar"><img src="assets/ui/heart.svg" alt="" width="22" height="22">'+say('Bevált ötlet','A familiar favourite')+'</button></div></div>';
  document.body.classList.toggle('workspace-crafting',!!craftState()?.open&&!isCooking());document.body.classList.toggle('craft-question-open',craftQuestion);
  document.body.classList.toggle('workspace-cooking',isCooking());
  document.body.classList.toggle('cooking-guided',isCooking()&&C.phase(thread())==='guided'&&cookingView==='focus');
  document.body.classList.toggle('cooking-stage-calm',isCooking()&&!cookingQuestion);document.body.classList.toggle('cooking-question-open',isCooking()&&cookingQuestion);
  document.body.classList.remove('cooking-reading');
  main.innerHTML='<section class="companion'+(craftState()?.open&&!messages.length?' is-crafting-start':'')+'" data-no-translate><div class="companion-heading"><button data-history aria-label="'+say('Beszélgetéstörténet','Conversation history')+'">'+icon('history')+'</button><span>'+esc(isCooking()?say('Főzés','Cooking'):thread().kind==='main'||!thread().title?say('Morzsa · a kuktád','Morzsa · your kitchen companion'):thread().title)+'</span><button data-new-chat aria-label="'+say('Új beszélgetés','New chat')+'" title="'+say('Új beszélgetés','New chat')+'">'+icon('new')+'</button></div>'+ (isCooking()||thread().kind==='legacy'?'<button class="companion-back-main" data-main>← '+say('Vissza Morzsához','Back to Morzsa')+'</button>':'')+cookingHeader()+'<div class="companion-messages">'+cookingGuide()+(window.WeeklyPlanUI?.markup(thread(),{esc})||'')+(thread().hasOlder?'<button class="small-button" data-older-messages>'+say('Korábbi üzenetek','Earlier messages')+'</button>':'')+renderMessages(messages,pendingSend?'':welcome)+(pendingSend?'<article class="companion-message user companion-pending-send">'+(pendingSend.photo?'<img class="companion-user-photo" src="'+esc(pendingSend.photo)+'" alt="'+say('Küldendő fotó','Photo to send')+'">':'')+'<p>'+esc(pendingSend.text)+'</p><small role="status">'+say('Küldés…','Sending…')+'</small></article>':'')+craftingMarkup()+(failedAnswer?'<article class="companion-message model">'+ChatFormat.render(failedAnswer,ingredientText)+'<small class="companion-result">'+say('A válasz félbeszakadt. Módosítást nem mentettünk.','Response interrupted. No changes were saved.')+'</small></article>':'')+(busy?'<article class="companion-message model"><p data-stream-answer aria-live="off">'+esc(streamVisible)+'</p></article><p class="companion-thinking" '+(streamVisible?'hidden':'')+' role="status">'+(startingTurn?say('Morzsa előkészíti a beszélgetést…','Morzsa is preparing the conversation…'):say('Morzsa gondolkodik…','Morzsa is thinking…'))+'</p>':'')+(error?'<div class="companion-error" role="alert"><p>'+esc(error)+'</p><button data-retry>'+say('Újrapróbálom','Try again')+'</button></div>':'')+'<div id="companion-nudge"></div>'+proposal()+'<div id="companion-end"></div></div><div class="companion-compose-wrap">'+(craftState()?.open?'<button class="craft-question-toggle" data-craft-question>'+ui('message-circle')+say(craftQuestion?'Vissza a válogatáshoz':'Kérdezek Morzsától',craftQuestion?'Back to ingredients':'Ask Morzsa')+'</button>':'')+(isCooking()?'<div class="cooking-reading-dock"><button data-reading-ingredients>'+kitchenBowl+say('Hozzávalók','Ingredients')+'</button><small>'+say('Morzsa a receptet és a lépést ismeri','Morzsa knows this recipe and step')+'</small></div>':'')+'<div class="companion-tools" role="group" aria-label="'+say('Háztartási gyorsműveletek','Household shortcuts')+'"><button data-full="overview" aria-label="'+say('Áttekintés','Overview')+'" title="'+say('Áttekintés','Overview')+'">'+icon('overview')+'</button><button data-quick="pantry" aria-label="'+say('Készlet','Pantry')+'" title="'+say('Készlet','Pantry')+'">'+icon('home')+'</button><button data-quick="shopping" aria-label="'+say('Lista','Shopping list')+' · '+state.cart.filter(i=>!i.done).length+'" title="'+say('Lista','Shopping list')+'">'+icon('cart')+(state.cart.some(i=>!i.done)?'<small aria-hidden="true">'+state.cart.filter(i=>!i.done).length+'</small>':'')+'</button></div>'+(attachment?'<div class="companion-attachment"><img src="'+attachment.photo+'" alt="'+say('Kiválasztott fotó','Selected photo')+'"><span>'+say('Küldéskor Morzsa megnézi','Morzsa will look when you send')+'</span><button type="button" data-remove-photo aria-label="'+say('Fotó eltávolítása','Remove photo')+'">×</button></div>':'')+'<form id="companion-form"><button type="button" data-photo aria-label="'+say('Fotó csatolása','Attach photo')+'" '+(busy||saving||pending||preparing?'disabled':'')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg></button><input type="file" id="companion-photo" accept="image/jpeg,image/png,image/webp" hidden><textarea id="companion-input" rows="1" maxlength="2000" aria-label="'+say('Üzenet Morzsának','Message Morzsa')+'" placeholder="'+(isCooking()?say('Kérdezz a receptről…','Ask about the recipe…'):composerOrigin==='pantry'?say('Mi fogyott el? Mire lenne szükség?','What ran out? What do you need?'):composerOrigin==='shopping'?say('Miben segítsek a bevásárlásnál?','How can I help with shopping?'):composerOrigin==='recipes'?say('Mit főzzünk? Milyen ötletet keresel?','What shall we cook? Any preferences?'):say('Kérdezz…','Ask…'))+'">'+esc(draft)+'</textarea><button type="button" data-mic aria-label="'+say('Kérdezés hanggal','Ask by voice')+'" '+(busy||saving||pending?'disabled':'')+'>'+voiceMicIcon+'</button><button type="submit" data-action="'+(busy?'stop':'send')+'" aria-label="'+(busy?say('Válasz leállítása','Stop response'):say('Küldés','Send'))+'" '+(saving||pending||preparing?'disabled':'')+'>'+(busy?'■':icon('arrow'))+'</button></form>'+'<div class="companion-disclosure">'+(!household?.userId()?'<button data-login>'+say('Belépés az AI-beszélgetéshez','Sign in to chat with AI')+'</button>':'')+'</div></div>'+cookingDock()+'</section>';
  mountAIMode();main.querySelector('[data-craft-question]')?.addEventListener('click',()=>{craftQuestion=!craftQuestion;renderChat();if(craftQuestion)main.querySelector('#companion-input')?.focus({preventScroll:true})});main.querySelector('[data-cooking-voice]')?.addEventListener('click',voice);main.querySelector('[data-reading-ingredients]')?.addEventListener('click',showCookingIngredients);
  main.querySelectorAll('[data-close-question]').forEach(b=>b.addEventListener('click',()=>{cookingQuestion=false;renderChat();window.scrollTo({top:cookingQuestionPosition,behavior:'instant'})}));main.querySelector('[data-open-cooking-question]')?.addEventListener('click',()=>{cookingQuestionPosition=scrollY;cookingQuestion=true;renderChat();main.querySelector('#companion-input')?.focus({preventScroll:true})});
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
  main.querySelector('#companion-form').onsubmit=e=>{e.preventDefault();if(busy){if(e.submitter?.dataset.action==='stop'&&performance.now()-sendStartedAt>=400)requestController?.abort()}else send(input.value)};
  main.querySelector('[data-older-messages]')?.addEventListener('click',()=>MorzsaPersistence.loadThread(book.active,true));
  main.querySelector('[data-history]').onclick=history;main.querySelector('[data-new-chat]').onclick=newChat;renderHistoryRail();
  main.querySelectorAll('[data-main]').forEach(b=>b.onclick=()=>goMain());
  main.querySelector('[data-finish-cooking]')?.addEventListener('click',finishCooking);
  main.querySelectorAll('[data-cook-again]').forEach(b=>b.onclick=()=>discuss(thread().recipe));
  main.querySelector('[data-mic]').onclick=voice;
  main.querySelector('[data-login]')?.addEventListener('click',()=>document.getElementById('household-button').click());
  main.querySelector('[data-retry]')?.addEventListener('click',()=>retryRequest?send(retryRequest.text,retryRequest.retry,retryRequest.recipeRequestOnly):send(thread().messages.at(-1)?.text||'',true));
  main.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>quick(b.dataset.quick));main.querySelectorAll('[data-full]').forEach(b=>b.onclick=()=>dashboardGo(b.dataset.full));
  main.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>send(({familiar:say('Adj egy bevált jellegű receptötletet a kedvenceink és a gyakran vásárolt alapanyagok alapján. Főleg abból főzzünk, ami most otthon van. Vedd figyelembe a főzési ízlésünket; ha még nincs előzmény, kérj egy rövid támpontot vagy adj egy egyszerű ötletet.', 'Suggest a familiar-style recipe based on our favourites and frequently purchased ingredients, prioritizing what is at home now and our cooking preferences. If there is no history, ask one brief question or suggest a simple dish.'),surprise:say('Lepj meg! Próbáljunk ki valami újat! Adj a közelmúltban főzöttektől eltérő receptet, főleg az otthoni alapanyagokból, legfeljebb két új, egyértelműen hiányzó hozzávalóval. Tartsd meg az ízlésbeli megkötéseinket.', 'Surprise me! Suggest a recipe different from our recent meals, mostly using what is at home, with at most two new, clearly missing ingredients. Respect our dietary and ingredient preferences.')})[b.dataset.prompt],false,true));
  main.querySelectorAll('[data-open-craft]').forEach(b=>b.onclick=()=>openCraft());main.querySelectorAll('[data-recraft]').forEach(b=>b.onclick=()=>openCraft(CraftingModel.selection(thread().messages[Number(b.dataset.recraft)]?.text)?.map(i=>i.name)||[]));
  main.querySelector('[data-close-craft]')?.addEventListener('click',()=>{const y=scrollY;craftState().open=false;renderChat();main.querySelector('[data-open-craft]')?.focus({preventScroll:true});window.scrollTo({top:y,behavior:'instant'})});
  const craftHost=main.querySelector('[data-craft-chat]');if(craftHost){const key=craftKey(),known=new Set(discoveries().map(d=>CraftingModel.combination(d.ingredients,craftResolve)));CraftingRoom.mount(craftHost,{context:key,embedded:true,state:craftState()?.snapshot,valid:()=>key===craftKey(),knownCombination:names=>{const combo=CraftingModel.combination(names,craftResolve);return known.has(combo)},busy:busy||saving||pending||preparing||startingTurn,onChange:snapshot=>{if(key===craftKey()&&craftHost.isConnected)craftDrafts.get(key).snapshot=snapshot},onDiscover:prompt=>{if(key===craftKey()&&craftHost.isConnected)send(prompt,false,true)}})}
  main.querySelector('[data-companion-apply]')?.addEventListener('click',apply);main.querySelector('[data-companion-edit]')?.addEventListener('click',editProposal);main.querySelector('[data-companion-discard]')?.addEventListener('click',()=>{markResult(say('Elvetve, nem módosítottunk semmit.','Dismissed; nothing was changed.'));renderChat()});
  main.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>{const key=RecipeShopping.key(cards[Number(b.dataset.recipe)]);expandedRecipes.has(key)?expandedRecipes.delete(key):expandedRecipes.add(key);const y=scrollY;renderChat();window.scrollTo(0,y)});
  main.querySelectorAll('[data-recipe-favourite]').forEach(b=>b.onclick=()=>saveChatFavourite(cards[Number(b.dataset.recipeFavourite)]));
  main.querySelectorAll('[data-recipe-shopping]').forEach(b=>b.onclick=()=>{const id=book.active,ctx=context;RecipeIngredientsPanel.open(cards[Number(b.dataset.recipeShopping)],{valid:()=>id===book.active&&ctx===scope()})});
  main.querySelectorAll('[data-view-recipe]').forEach(b=>b.onclick=()=>{savePosition();RecipeRoom.open(cards[Number(b.dataset.viewRecipe)])});
  main.querySelectorAll('[data-cook]').forEach(b=>b.onclick=()=>discuss(cards[Number(b.dataset.cook)]));
  main.querySelectorAll('[data-inline-recipe]').forEach(host=>RecipeRoom.mount(host,cards[Number(host.dataset.inlineRecipe)]));
  if(thread().readOnly){main.querySelector('.companion-compose-wrap').innerHTML='<div class="shared-chat-dock"><span>'+say('A háztartással megosztott beszélgetés','Conversation shared with the household')+'</span><button class="room-continue" data-fork-chat>'+say('Saját beszélgetésként folytatom','Continue in my own chat')+'</button></div>';main.querySelector('[data-fork-chat]').onclick=()=>MorzsaPersistence.fork(thread())}
  if(isCooking())window.RecipeImages?.mount(main.querySelector('#cooking-cover'),thread().recipe,-1,{autoCreate:true,hero:true});
  if(isCooking()&&C.phase(thread())==='preparation')RecipeRoom.mount(main.querySelector('#cooking-ingredients'),thread().recipe,{ingredientsOnly:true,hidePortions:true,portions:thread().portions,onPortions:changePortions,readOnly:thread().readOnly});
  mountCookingImages();
  bindCookingControls();window.WeeklyPlanUI?.bind(main,thread());
  main.querySelectorAll('[data-generated-recipe]').forEach(host=>window.RecipeImages?.mount(host,cards[Number(host.dataset.generatedRecipe)],-1,{autoCreate:true}));
  updateNudge();viewport();animateAnswer();window.MorzsaWorkspace?.mount();if(timerFocus&&timerFocus.key===main.querySelector('[data-timer-editor]')?.dataset.timerEditor){main.querySelector('[data-custom-timer] input')?.focus({preventScroll:true});window.scrollTo({top:timerFocus.scroll,behavior:'instant'})}
 }
 function scrollEnd(){requestAnimationFrame(()=>main.querySelector('#companion-end')?.scrollIntoView({block:'end',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}))}
 function panel(id){let q=document.getElementById(id);if(!q){q=document.createElement('dialog');q.id=id;q.setAttribute('data-no-translate','');document.body.append(q);PanelGestures.bind(q,{axis:id==='companion-history'?'x':'y',allowControls:id==='companion-history'})}return q}
 function historyMarkup(rail=false){
  const groups=M.historyTimeline(book),disabled=busy||saving||pending||preparing;
  const row=t=>'<button class="history-thread" data-thread="'+esc(t.id)+'" '+(disabled?'disabled':'')+' aria-current="'+(t.id===book.active)+'">'+ui(t.kind==='recipe'?'chef-hat':'message-circle')+'<strong>'+esc(t.title||(t.kind==='main'?say('Morzsa · a kuktád','Morzsa · your kitchen companion'):say('Új beszélgetés','New chat')))+'</strong><small>'+new Date(M.historyTimestamp(t)).toLocaleDateString(language==='en'?'en-GB':'hu-HU',{month:'short',day:'numeric'})+(t.readOnly?' · '+say('Megosztva veled','Shared with you'):'')+(t.kind==='recipe'?' · '+say(t.status==='completed'?'Megfőzve':'Folyamatban',t.status==='completed'?'Cooked':'In progress'):t.archivedAt?' · '+say('Archivált','Archived'):'')+'</small></button>';
  const dated=items=>{const groups=new Map(),today=M.dayKey(Date.now()),yesterday=M.dayKey(Date.now()-86400000);for(const t of items){const day=M.dayKey(M.historyTimestamp(t)),label=day===today?say('Ma','Today'):day===yesterday?say('Tegnap','Yesterday'):say('Korábbi','Earlier');if(!groups.has(label))groups.set(label,[]);groups.get(label).push(t)}return [...groups].map(([label,rows])=>'<section class="history-date-group"><h4>'+label+'</h4>'+rows.map(row).join('')+'</section>').join('')};
  const sharing=thread()?.readOnly?'<p class="history-visibility">'+say('Megosztva veled · csak olvasható','Shared with you · read only')+'</p>':cloudEnabled()?'<details class="history-sharing"><summary>'+say('Beszélgetés adatvédelme','Conversation privacy')+'</summary><p>'+esc(thread()?.sharedHousehold?say('Megosztva: ','Shared with: ')+(thread().sharedHousehold===household.active?household.activeName?.()||say('háztartás','household'):say('háztartás','household')):say('Csak te látod','Only you can see this'))+'</p><button data-share-chat '+(disabled||!household?.active&&!thread()?.sharedHousehold?'disabled':'')+'>'+ui('share-2')+say(thread()?.sharedHousehold?'Megosztás megszüntetése':'Megosztás a háztartással',thread()?.sharedHousehold?'Stop sharing':'Share with household')+'</button></details>':'';
  return '<div class="companion-panel-head"><h2>'+say('Beszélgetések','Conversations')+'</h2>'+(rail&&isCooking()?'<button data-cooking-history aria-label="'+say('Beszélgetések megnyitása','Open conversations')+'">'+ui('arrow-right')+'</button>':'')+(!rail?'<button data-close aria-label="'+say('Bezárás','Close')+'">×</button>':'')+'</div><input class="history-search" type="search" data-history-search placeholder="'+say('Keresés: cím, recept, üzenet…','Search titles, recipes, messages…')+'" aria-label="'+say('Keresés az előzményekben','Search conversations')+'"><p class="history-empty" hidden role="status">'+say('Nincs ilyen beszélgetés.','No matching conversation.')+'</p><button class="companion-new" data-new-chat '+(disabled?'disabled':'')+'>'+say('Új beszélgetés','New chat')+ui('plus')+'</button><div class="companion-history-items">'+dated(groups.recent)+(groups.archive.length?'<details class="history-archive" '+(groups.archive.some(t=>t.id===book.active)?'open':'')+'><summary>'+ui('archive')+say('Archívum','Archive')+' <small>'+groups.archive.length+'</small></summary>'+dated(groups.archive)+'</details>':'')+(cloudEnabled()&&MorzsaPersistence.more()?'<button class="small-button" data-more-history>'+say('Régebbi beszélgetések','Older conversations')+'</button>':'')+'</div>'+sharing+(!isCooking()?'<button class="history-archive-current" data-archive '+(disabled||!thread().messages.length?'disabled':'')+'>'+say(thread().archivedAt?'Vissza a beszélgetésekhez':'Beszélgetés archiválása',thread().archivedAt?'Return to conversations':'Archive conversation')+'</button>':'')+'<p class="companion-caption history-privacy">'+(cloudEnabled()?say(({loading:'Előzmények betöltése…',pending:'Mentésre vár',synced:thread()?.readOnly?'Szinkronizálva':'Mentve a fiókodban',failed:'Szinkronhiba · újrapróbálás',access:'Hozzáférés megszűnt',storage:'Helyi mentés megtelt'})[MorzsaPersistence.status()]||'Mentésre vár',({loading:'Loading history…',pending:'Waiting to sync',synced:thread()?.readOnly?'Synced':'Saved in your account',failed:'Sync failed · retry',access:'Access removed',storage:'Local storage full'})[MorzsaPersistence.status()]||'Waiting to sync'):say('Ezen az eszközön','This device'))+'</p>';
 }
 function bindHistory(host){
  host.querySelector('[data-history-search]').oninput=e=>{const q=QuickEntry.norm(e.target.value);let found=0;host.querySelectorAll('[data-thread]').forEach(b=>{const t=book.threads.find(t=>t.id===b.dataset.thread);b.hidden=!!q&&!QuickEntry.norm([t?.title,t?.recipe?.title,...(t?.messages||[]).map(m=>m.text)].join(' ')).includes(q);if(!b.hidden)found++});host.querySelector('.history-empty').hidden=!q||found>0;host.querySelectorAll('.history-date-group').forEach(g=>g.hidden=![...g.querySelectorAll('[data-thread]')].some(b=>!b.hidden));if(q)host.querySelectorAll('.history-archive').forEach(d=>d.open=true)};
  host.querySelector('[data-cooking-history]')?.addEventListener('click',history);
  host.querySelector('[data-close]')?.addEventListener('click',()=>host.close());host.querySelector('[data-new-chat]').onclick=newChat;host.querySelector('[data-archive]')?.addEventListener('click',archiveCurrent);
  host.querySelector('[data-more-history]')?.addEventListener('click',()=>MorzsaPersistence.moreHistory());
  host.querySelector('[data-share-chat]')?.addEventListener('click',()=>shareChat());
  host.querySelector('.history-privacy')?.addEventListener('click',()=>MorzsaPersistence.retry());
  host.querySelectorAll('[data-thread]').forEach(b=>b.onclick=()=>selectThread(b.dataset.thread));
 }
 function shareChat(){
  const t=thread();if(!t||t.readOnly)return;const current=context,hid=t.sharedHousehold?null:household.active;const host=document.querySelector('#companion-history[open] .history-sharing')||document.querySelector('#companion-history-rail .history-sharing');if(!host)return;
  host.innerHTML='<p><strong>'+esc(household.activeName?.()||say('Közös háztartás','Shared household'))+'</strong></p><p>'+say(t.sharedHousehold?'A többiek ezután nem férnek hozzá ehhez a beszélgetéshez.':'A teljes beszélgetés, csatolt fotói és későbbi üzenetei is láthatók lesznek az aktuális háztartásban.',t.sharedHousehold?'Others will no longer have access to this conversation.':'The entire conversation, its photos and future messages will be visible in this household.')+'</p><button data-confirm-share>'+say(t.sharedHousehold?'Megosztás megszüntetése':'Megosztom',t.sharedHousehold?'Stop sharing':'Share')+'</button><button data-cancel-share>'+say('Mégsem','Cancel')+'</button>';host.querySelector('[data-cancel-share]').onclick=()=>{renderHistoryRail(true);if(document.querySelector('#companion-history[open]'))history()};host.querySelector('[data-confirm-share]').onclick=async e=>{if(current!==scope())return;e.target.disabled=true;try{await MorzsaPersistence.share(t.id,hid);renderHistoryRail(true);toast(say('Megosztás frissítve.','Sharing updated.'));if(document.querySelector('#companion-history[open]'))history()}catch{toast(say('Előbb fejezzük be a szinkronizálást. Próbáld újra.','Finish syncing first. Try again.'));e.target.disabled=false}};
 }
 function historyView(host){
  if(host.dataset.activeThread!==book.active)return null;const focused=document.activeElement;
  return {sharing:!!host.querySelector('.history-sharing')?.open,query:host.querySelector('[data-history-search]')?.value||'',scroll:host.querySelector('.companion-history-items')?.scrollTop||0,focus:['[data-history-search]','[data-share-chat]','.history-sharing summary'].find(selector=>host.querySelector(selector)===focused)};
 }
 function restoreHistoryView(host,view){
  host.dataset.activeThread=book.active;if(!view)return;const sharing=host.querySelector('.history-sharing');if(sharing)sharing.open=view.sharing;
  const search=host.querySelector('[data-history-search]');if(search&&view.query){search.value=view.query;search.dispatchEvent(new Event('input'))}const items=host.querySelector('.companion-history-items');if(items)items.scrollTop=view.scroll;if(view.focus)host.querySelector(view.focus)?.focus({preventScroll:true});
 }
 function renderHistoryRail(force=false){
  if(!force&&document.querySelector('#companion-history-rail [data-confirm-share]'))return;
  let rail=document.getElementById('companion-history-rail');
  if(!rail){rail=document.createElement('aside');rail.id='companion-history-rail';rail.setAttribute('data-no-translate','');rail.setAttribute('aria-label',say('Beszélgetéstörténet','Conversation history'));document.body.append(rail)}
  rail.hidden=!matchMedia('(min-width:1000px)').matches;if(rail.hidden)return;const view=historyView(rail);rail.innerHTML=historyMarkup(true);bindHistory(rail);restoreHistoryView(rail,view);
 }
 function history(){
  sync();if(matchMedia('(min-width:1000px)').matches){renderHistoryRail();document.querySelector('#companion-history-rail [aria-current="true"]')?.focus();return null}
  const q=panel('companion-history'),view=historyView(q);q.setAttribute('aria-labelledby','conversation-history-title');q.innerHTML=historyMarkup();q.querySelector('h2').id='conversation-history-title';bindHistory(q);restoreHistoryView(q,view);window.MorzsaWorkspace?.attachSettings(q);if(!q.open)q.showModal();return q;
 }
 function removed(names){sync();removedNames=[...new Set([...names,...removedNames])].slice(0,10);updateNudge()}
 function nudge(){if(isCooking()||craftState()?.open||busy||saving||pending)return null;const existing=M.suggestion(state,PantryReview?.candidates()||[],removedNames,deferred),refill=typeof KitchenModel==='undefined'?null:KitchenModel.shoppingSuggestion(state,deferred),n=['bought','restock'].includes(existing?.type)?existing:refill||existing;return ['review','low','recurring'].includes(n?.type)&&Date.now()<quietUntil?null:n}
 function updateNudge(){
  if(context!==scope())return;
  const host=main.querySelector('#companion-nudge');if(!host||host.querySelector('[data-inline-review]'))return;const n=nudge();if(window.MorzsaProactive?.chat(host,{quiet:isCooking()||!!craftState()?.open||busy||saving||!!pending,bought:n?.type==='bought',hasMessages:M.currentMessages(thread()).length>0}))return;if(!n){host.innerHTML='';return}
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
   q.setAttribute('aria-labelledby','quick-panel-title');q.innerHTML='<div class="companion-sheet-handle" aria-hidden="true"></div><button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><div class="ingredient-action-heading"><img src="'+(productArtwork[name]||'assets/icons/oats.webp')+'" alt="" width="52" height="52"><div><h2 id="ingredient-action-title">'+esc(displayName(name))+'</h2><p>'+say(home?'Van otthon':'Nincs megjelölve otthon',home?'At home':'Not marked at home')+(listed?say(' · A listán is',' · On the list'):'')+'</p></div></div><div class="ingredient-action-buttons"><button data-ingredient-list '+(listed?'disabled':'')+'>'+icon('cart')+say(listed?'Már a listán':'Listára teszem',listed?'Already on list':'Add to list')+'</button><button data-ingredient-stock '+(home?'disabled':'')+'>'+icon('home')+say(home?'Van otthon':'Van otthon',home?'At home':'Add to pantry')+'</button></div><p class="ingredient-action-error" role="status"></p>';
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
   q.setAttribute('aria-labelledby','quick-panel-title');q.innerHTML='<div class="companion-sheet-handle" aria-hidden="true"></div><div class="companion-panel-head"><h2 id="quick-panel-title">'+say(isList?'Bevásárlólista':'Mi van otthon?',isList?'Shopping list':'Your pantry')+'</h2><button data-close aria-label="'+say('Bezárás','Close')+'">×</button></div><div class="companion-panel-tools"><span>'+names.length+say(' termék',' products')+'</span><button data-expand>'+say('Teljes nézet','Full view')+' ↗</button></div><div class="companion-quick-items">'+(visible.length?cats.map(c=>'<section><h3>'+esc(language==='en'?englishText(c):c)+'</h3>'+(isList?'<div>':'<div class="companion-stock-grid">')+visible.filter(n=>productCategory(n)===c).map(n=>{const i=names.indexOf(n),item=state.cart.find(x=>x.name===n);return isList?'<div class="companion-list-row"><input type="checkbox" id="quick-cart-'+i+'" data-check="'+i+'" '+(item.done?'checked':'')+'><span><label for="quick-cart-'+i+'">'+esc(displayName(n))+'</label>'+(window.RecipeRoom?.sourceMarkup(item)||'')+'</span><small>'+esc(cartAmount(item))+'</small></div>':'<article class="companion-stock-item"><img src="'+(productArtwork[n]||'assets/icons/oats.webp')+'" alt="" width="40" height="40"><strong>'+esc(displayName(n))+'</strong><small>'+pantryStateLabel(WorkspaceEntry.availability(state.stock[n]))+(item?say(' · Listán',' · Listed'):'')+'</small><div><button data-list="'+i+'" '+(item?'disabled':'')+' aria-label="'+esc(displayName(n))+say(' a listára',' to list')+'">'+icon('cart')+'</button><button data-gone="'+i+'">'+say('Elfogyott','Used up')+'</button></div></article>'}).join('')+'</div></section>').join(''):'<p class="companion-caption">'+say(isList?'A listád most üres.':'Most nincs megjelölt termék.',isList?'Your list is empty.':'No products marked at home.')+'</p>')+'</div><button class="companion-quick-add" data-add>＋ '+say(isList?'Felírok valamit':'Hozzáadok valamit',isList?'Add to list':'Add to pantry')+'</button>';
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
 document.addEventListener('visibilitychange',()=>{if(document.hidden){savePosition();stopReveal()}else{resumeSession();if(page==='chat'&&renderedDay!==M.dayKey(Date.now())&&!busy&&!pending)renderChat();else updateNudge()}});
 window.addEventListener('pagehide',savePosition);window.addEventListener('morzsa-pause',savePosition);window.addEventListener('morzsa-resume',resumeSession);
 for(const event of ['click','input','keydown','pointerdown','wheel'])document.addEventListener(event,()=>{lastActivity=Date.now();clearTimeout(sessionTimer);sessionTimer=setTimeout(savePosition,150)},{passive:true});
 window.addEventListener('scroll',()=>{clearTimeout(sessionTimer);sessionTimer=setTimeout(savePosition,150)},{passive:true});
 document.querySelector('header').insertAdjacentHTML('afterbegin','<button class="companion-header-history" aria-label="Beszélgetéstörténet" data-no-translate>☰</button>');
 document.querySelector('.companion-header-history').onclick=()=>{history()};
 const edge=document.createElement('div');edge.className='companion-history-edge';edge.setAttribute('aria-hidden','true');document.body.append(edge);PanelGestures.bind(edge,{axis:'x',edge:true,disabled:()=>matchMedia('(min-width:1000px)').matches||!!document.querySelector('dialog[open]'),open:history});
 PanelGestures.bind(main,{axis:'x',edge:true,ignoreControls:true,allowInline:true,disabled:()=>page!=='chat'||matchMedia('(min-width:1000px)').matches||!!document.querySelector('dialog[open]'),open:history});
 window.addEventListener('resize',()=>{if(matchMedia('(min-width:1000px)').matches)document.getElementById('companion-history')?.close();renderHistoryRail()});
 setInterval(()=>{if(!document.hidden&&page==='chat'&&!busy&&!saving&&!pending&&!preparing&&renderedDay!==M.dayKey(Date.now()))renderChat()},30000);
 sync();queueMicrotask(()=>render());
 window.addEventListener('morzsa-ai-mode-change',()=>{if(pendingSend){draft=draft||pendingSend.text;attachment=attachment||pendingSend.attachment;pendingSend=null}requestController?.abort();serial++;busy=false;startingTurn=false;error='';resetStream();if(page==='chat')renderChat();else render()});
 return {composerContext:()=>JSON.stringify([scope(),household?.active,book.active]),canChangeAIMode:()=>!(busy||saving||pending||preparing||window.MorzsaRealtime?.running()),mountResume,returnToChat:y=>{page='chat';render();window.scrollTo({top:y,behavior:'instant'})},openRecipeChat:r=>{if(discuss(r)){cookingQuestionPosition=scrollY;cookingQuestion=true;renderChat();main.querySelector('#companion-input')?.focus()}},discoveries:()=>{sync();return discoveries()},saveWeeklySchedule,planWeek,resumeCooking,activity,askRecipe,openHistory:history,openContext:origin=>{goMain('',origin);main.querySelector('#companion-input')?.focus()},newChat,recipeThreads:()=>{sync();return M.historyGroups(book).recipes.filter(t=>t.recipe).map(t=>({id:t.id,title:t.title,status:t.status,updated:t.updated,recipe:structuredClone(t.recipe)}))},openThread:selectThread,ask,voice:askVoice,render:renderChat,open:goMain,onNavigate,updateNudge,removed,quick,refreshQuick:()=>refreshQuick(),purchaseSaved:(before,after,ctx)=>showVoiceUndo(M.changes(before,after),ctx),discuss,showRecipe:r=>window.RecipeRoom?.open(r)};
})();
