// One suggestion lifecycle across overview, chat, recipes and shopping.
window.MorzsaProactive=(()=>{
 const M=ProactiveModel,say=(hu,en)=>language==='en'?en:hu;
 let context='',feedback={},remote=null,remoteReady=false,loading=false,busy=false,loadedAt=0,requestedState='',generation=0;
 const positions=new Map(),selection=new Set();
 let ingredientKey='',ingredientMatches=new Map();
 function ingredientResolver(){
  const key=JSON.stringify(state.custom);if(key!==ingredientKey){ingredientKey=key;ingredientMatches.clear()}
  const items=[...catalog,...state.custom];
  return name=>{
   if(ingredientMatches.has(name))return ingredientMatches.get(name);
   const resolved=QuickEntry.match(name,items,productEnglish)||name;
   if(ingredientMatches.size>=512)ingredientMatches.delete(ingredientMatches.keys().next().value);
   ingredientMatches.set(name,resolved);return resolved;
  };
 }
 const scope=()=>JSON.stringify([household?.userId()||'guest',household?.active||'local']);
 const storage=()=> 'morzsa-proactive-v1:'+context;
 const icon=n=>'<img src="assets/ui/'+n+'.svg" width="20" height="20" alt="">';
 function sync(){
  if(context===scope())return;context=scope();generation++;remote=null;remoteReady=false;loading=false;loadedAt=0;requestedState='';selection.clear();positions.clear();
  try{feedback=M.cleanFeedback(JSON.parse(localStorage.getItem(storage())))}catch{feedback={}}
 }
 const stateKey=()=>JSON.stringify([state.stock,state.cart,state.history]);
 async function refresh(force=false){
  sync();if(!household?.active||!household.dataRpc||loading||busy||!force&&Date.now()-loadedAt<20000&&requestedState===stateKey())return;
  const current=context,epoch=generation,hid=household.active;loading=true;requestedState=stateKey();
  try{const value=await household.dataRpc('read_proactive_suggestions',{hid});if(current!==scope()||epoch!==generation)return;if(!Array.isArray(value?.suggestions))throw Error('Setup');remote=value.suggestions;feedback={...feedback,...M.cleanFeedback(value.feedback)};remoteReady=true}
  catch{if(current===scope()&&epoch===generation){remote=null;remoteReady=false}}
  finally{if(epoch===generation){loading=false;loadedAt=Date.now();mount();window.MorzsaCompanion?.updateNudge()}}
 }
 function products(){
  sync();const local=M.candidates(state,{reviews:PantryReview?.candidates()||[],feedback,confirmedAt:n=>PantryReview?.confirmedAt?.(n)});
  if(!remoteReady)return local;
  const listed=new Set(state.cart.map(i=>M.norm(i.name))),shared=(remote||[]).filter(s=>s.expiresAt>Date.now()&&!listed.has(M.norm(s.name))&&M.visible(s,feedback));
  return [...shared,...local.filter(s=>s.kind==='review'&&!shared.some(x=>M.norm(x.name)===M.norm(s.name))).map(s=>({...s,fingerprint:'review:'+(household.rows.find(r=>r.bucket==='stock'&&r.key===s.name)?.revision||0)}))].slice(0,20);
 }
 function recommendations(){
  const curated=recipes.map((r,i)=>({recipeId:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),curated:r.id,title:language==='en'?englishText(r.name):r.name,summary:language==='en'?englishText(r.desc):r.desc,minutes:r.time,servings:r.servings,ingredients:r.ingredients.map(([name,amount])=>({name,amount})),stepTitles:r.stepTitles?.map(s=>language==='en'?englishText(s):s),steps:r.steps.map(s=>language==='en'?englishText(s):s),tags:r.tags}));
  const feed=page==='recipes'?window.RecipeLibrary?.overview():null,list=[...(feed?.entries||[]),...(feed?.library||[]),...curated];
  return M.rankRecipes(list,{stock:state.stock,uncertain:PantryReview?.uncertain()||[],resolve:ingredientResolver(),feedback,
   prefs:KitchenIntelligence?.prefs()||{},favourites:[...curated.filter(r=>state.likes.includes(r.curated)).map(r=>r.recipeId),...(feed?.library||[]).filter(r=>r.favourite).map(r=>r.recipeId)],
   recent:KitchenIntelligence?.recentTitles()||[],accepts:r=>KitchenModel.accepts(r,KitchenIntelligence?.prefs()||{},[...catalog,...state.custom],productEnglish)});
 }
 function reason(s){
  if(s.kind==='out')return say('Elfogyottnak jelöltétek.','Marked as used up.');
  if(s.kind==='low')return say('Kevésnek jelöltétek.','Marked as running low.');
  if(s.kind==='review')return s.unknown?say('Még nincs megerősítve, hogy megvan-e.','Its presence has not been confirmed yet.'):Math.floor(s.age)+say(' napja ellenőriztétek. Megvan még?',' days since the last check.');
  return say(s.samples+' korábbi vásárlás alapján kb. '+Math.round(s.days)+' naponta veszitek. '+(s.remaining?s.remaining+' napon belül újra szükség lehet rá.':'Mostanában újra szükség lehet rá.'),s.samples+' previous purchases, roughly every '+Math.round(s.days)+' days. '+(s.remaining?'You may need it again within '+s.remaining+' days.':'You may need it again around now.'));
 }
 const confidence=s=>s.confidence==='confirmed'?say('Jelzett készlet','Reported availability'):s.kind==='review'?say('Ellenőrzendő','Needs a check'):say('Becslés · vásárlási ritmus','Estimate · shopping rhythm');
 function productCard(s,compact=false){
  const key=esc(s.id),name=esc(displayName(s.name));
  const stillHere='<button data-proactive-action="still_here" data-proactive-id="'+key+'">'+say(s.kind==='out'?'Már megvan':'Van még',s.kind==='out'?'Already have it':'Still here')+'</button>';
  return '<article class="proactive-card" data-proactive-card="'+key+'"><div class="proactive-product"><img src="'+(productArtwork[s.name]||'assets/icons/oats.webp')+'" width="32" height="32" alt=""><div><h3>'+name+'</h3><p>'+(s.confidence!=='confirmed'&&s.kind!=='review'?'<span class="proactive-evidence">'+confidence(s)+' · </span>':'')+esc(reason(s))+'</p></div></div><div class="proactive-actions">'+(compact?'<label class="proactive-select"><input type="checkbox" data-proactive-select="'+key+'" '+(selection.has(s.id)?'checked':'')+'><span class="sr-only">'+name+say(' kiválasztása',' select')+'</span></label>':s.kind==='review'?stillHere:'<button class="proactive-primary proactive-add" data-proactive-action="accepted" data-proactive-id="'+key+'" aria-label="'+name+say(' · Listára teszem',' · Add to list')+'" title="'+say('Listára teszem','Add to list')+'">'+icon('plus')+'</button>')+'<details class="proactive-feedback"><summary aria-label="'+name+say(' · további lehetőségek',' · more options')+'">···</summary><div>'+(compact||s.kind!=='review'?stillHere:'')+'<button data-proactive-action="dismissed" data-proactive-id="'+key+'">'+say('Most nem · 1 hét','Not now · 1 week')+'</button><button data-proactive-action="later" data-proactive-id="'+key+'">'+say('Máskor · 3 nap múlva','Later · in 3 days')+'</button></div></details></div></article>';
 }
 function recipeCard(s){
  const r=s.recipe,names=s.home.slice(0,3).map(displayName).join(', '),missing=s.missing.slice(0,3).map(displayName).join(', ');
  return '<article class="proactive-recipe" data-proactive-card="'+esc(s.id)+'"><div class="proactive-recipe-art">'+r.ingredients.slice(0,3).map(i=>'<img src="'+(productArtwork[QuickEntry.match(i.name,catalog,productEnglish)||i.name]||'assets/icons/oats.webp')+'" width="48" height="48" alt="">').join('')+'<div class="room-image-cache" data-proactive-image="'+esc(s.recipeId)+'"></div></div><div><span class="proactive-evidence">'+(s.minutes?s.minutes+say(' perc',' min'):'')+(s.servings?' · '+s.servings+say(' adag',' servings'):'')+(s.favourite?' · '+say('Kedvenc','Favourite'):'')+'</span><h3>'+esc(r.title)+'</h3><p class="proactive-match">'+s.home.length+'/'+s.total+say(' hozzávaló megerősítve',' ingredients confirmed')+'</p>'+(names?'<p>'+say('Felhasználhatod: ','Use what you have: ')+esc(names)+'.</p>':'')+(s.check.length?'<p>'+say('Még ellenőrizendő: ','Still to check: ')+esc(s.check.map(displayName).join(', '))+'.</p>':'')+(missing?'<p>'+say('Nincs otthon jelölve: ','Not marked at home: ')+esc(missing)+(s.missing.length>3?'…':'.')+'</p>':'')+'<div class="proactive-actions"><button class="proactive-primary" data-proactive-recipe="'+esc(s.recipeId)+'">'+say('Megnézem a receptet','View recipe')+' →</button><details class="proactive-feedback"><summary aria-label="'+esc(r.title)+say(' · visszajelzés',' · feedback')+'">···</summary><div><button data-proactive-recipe-useful="'+esc(s.recipeId)+'">'+say('Hasznos ötlet','Useful idea')+'</button><button data-proactive-recipe-later="'+esc(s.recipeId)+'">'+say('Máskor · 3 nap múlva','Later · in 3 days')+'</button></div></details></div></div></article>';
 }
 function setHost(parent,selector,html,insert){
  if(!parent)return null;let host=parent.querySelector(selector);
  if(!host){host=document.createElement('section');host.className=selector.slice(1);host.setAttribute('data-no-translate','');insert?insert(host):parent.append(host)}
  if(host._markup!==html){const active=host.contains(document.activeElement)?[...document.activeElement.attributes].filter(a=>a.name.startsWith('data-proactive-')).map(a=>[a.name,a.value]):[];const folded=host.querySelector('[data-proactive-fold]')?.open;const open=[...host.querySelectorAll('details[open]')].map(d=>d.closest('[data-proactive-card]')?.dataset.proactiveCard);host.innerHTML=html;host._markup=html;host.querySelectorAll('details').forEach(d=>{const key=d.closest('[data-proactive-card]')?.dataset.proactiveCard;if(key)d.open=open.includes(key)});if(folded!==undefined&&host.querySelector('[data-proactive-fold]'))host.querySelector('[data-proactive-fold]').open=folded;bind(host);if(active.length)[...host.querySelectorAll('button,input,summary')].find(el=>active.every(([name,value])=>el.getAttribute(name)===value))?.focus({preventScroll:true})}host.setAttribute('aria-busy',String(busy));if(busy)host.querySelectorAll('[data-proactive-action],[data-proactive-approve]').forEach(b=>b.disabled=true);return host;
 }
 function mount(){
  sync();document.body.classList.add('proactive-enabled');if(!loading&&!busy)queueMicrotask(()=>refresh());
  const items=products(),picks=page==='overview'||page==='recipes'?recommendations():[];
  if(page==='overview'){
   const shown=items.slice(0,picks.length?2:3),html='<div class="proactive-heading"><div><h2>'+say('Érdemes ránézni','Worth a look')+'</h2></div><img src="assets/brands/morzsa.svg" width="28" height="28" alt=""></div>'+(shown.length?'<div class="proactive-grid">'+shown.map(s=>productCard(s)).join('')+'</div>':!picks.length?'<p class="proactive-empty">'+say(Object.keys(state.stock).length?'Most nincs sürgős javaslat. Ha változott valami, jelezd Morzsának.':'Néhány otthoni alapanyagból már tudok ötletet adni.',Object.keys(state.stock).length?'No pressing suggestions right now. Tell Morzsa if something changed.':'Add a few pantry items and I can help you find ideas.')+'</p>':'')+(picks.length?'<h2 class="proactive-subheading">'+say('Morzsa ajánlja','Morzsa recommends')+'</h2>'+recipeCard(picks[0]):'')+privacyNote();
   setHost(main.querySelector('.dashboard'),'.proactive-overview',html,host=>main.querySelector('.daily-counts')?.after(host));
  }
  if(page==='shopping'&&!ShoppingMode?.visible()){
   const list=items.filter(s=>s.kind!=='review').slice(0,5);for(const id of selection)if(!list.some(s=>s.id===id))selection.delete(id);
   const html=list.length?'<details class="proactive-shopping-fold" data-proactive-fold '+(!state.cart.length?'open':'')+'><summary>'+icon('sparkles')+'<span>'+say('Jól jöhet a listádra','Useful for your list')+'</span><small>'+list.length+say(' javaslat',' ideas')+'</small></summary><div class="proactive-grid">'+list.map(s=>productCard(s,true)).join('')+'</div><button class="proactive-primary proactive-approve" data-proactive-approve '+(!selection.size?'disabled':'')+'>'+say('Kijelöltek a listára','Add selected to list')+' · '+selection.size+'</button>'+privacyNote()+'</details>':'';
   setHost(main,'.proactive-shopping',html,host=>(main.querySelector('#add-cart')||main.querySelector('.pantry-heading'))?.after(host));
  }
  if(page==='recipes'&&main.querySelector('.recipe-library[data-feed-tab="for-you"]')){
   setHost(main.querySelector('.recipe-library'),'.proactive-recommendations',picks.length?'<h2>'+say('Morzsa ajánlja','Morzsa recommends')+'</h2><p class="proactive-caption">'+say('A készletedből és a főzési ízlésedből indulunk.','Based on your pantry and cooking preferences.')+'</p>'+picks.slice(0,2).map(recipeCard).join(''):'',host=>main.querySelector('.recipe-feed-tabs')?.after(host));
   const featured=new Set(picks.slice(0,2).map(s=>s.recipeId));main.querySelectorAll('.recipe-discovery-section').forEach(section=>{const cards=[...section.querySelectorAll('.room-card')];cards.forEach(card=>card.hidden=featured.has(card.querySelector('[data-feed-recipe]')?.dataset.feedRecipe));section.hidden=cards.length>0&&cards.every(card=>card.hidden)});
  }
 }
 function privacyNote(){return '<p class="proactive-caption">'+say(household?.active&&remoteReady?'A visszajelzést a közös konyha megjegyzi.':'A visszajelzést ebben a konyhában, ezen az eszközön jegyzem meg.',household?.active&&remoteReady?'Feedback is remembered by your shared kitchen.':'Feedback is remembered for this kitchen on this device.')+'</p>'}
 function chat(host,{quiet=false,bought=false,hasMessages=false}={}){
  if(bought)return false;sync();if(quiet){if(host.querySelector('.proactive-chat'))host.replaceChildren();return true}
  const weight={out:100,low:90,recurring:65},items=products().filter(s=>s.kind!=='review').sort((a,b)=>(weight[b.kind]||0)-(weight[a.kind]||0)||(b.score||0)-(a.score||0)),shown=items.slice(0,6),picks=shown.length||hasMessages?[]:recommendations();
  if(!shown.length&&!picks.length)return false;
  const html=shown.length?'<aside class="proactive-chat proactive-restock"><div class="proactive-heading"><h2>'+say('Érdemes pótolni','Worth restocking')+'</h2><span>'+shown.length+say(' tétel',' items')+'</span></div><p class="proactive-caption">'+say('Elöl az elfogyott, utána a kevésnek jelölt tételek. A vásárlási becslést külön jelzem.','Used-up items first, then those running low. Shopping estimates are labelled.')+'</p><ol>'+shown.map(s=>'<li>'+productCard(s)+'</li>').join('')+'</ol>'+(items.length>shown.length?'<button data-proactive-overview>'+say('További javaslatok','More suggestions')+icon('arrow-right')+'</button>':'')+'</aside>':'<aside class="proactive-chat"><p><strong>'+esc(picks[0].recipe.title)+'</strong><br>'+say('Ötlet a készletedből.','An idea from your pantry.')+'</p><div class="proactive-actions"><button data-proactive-recipe="'+esc(picks[0].recipeId)+'">'+say('Megnézem','View recipe')+icon('arrow-right')+'</button></div></aside>';
  if(host._proactiveHTML!==html||!host.querySelector('.proactive-chat')){host.innerHTML=html;host._proactiveHTML=html;bind(host)}return true;
 }

 async function respond(selected,action){
  sync();if(!selected.length||busy||household?.busy||household?.cartPending)return;
  const current=context,epoch=generation,live=products();
  if(selected.some(s=>!live.some(x=>x.id===s.id&&x.fingerprint===s.fingerprint))){toast(say('A javaslat közben változott. Nézd át újra.','The suggestion changed. Please review it again.'));mount();return}
  busy=true;document.querySelectorAll('[data-proactive-action],[data-proactive-approve]').forEach(b=>b.disabled=true);let saved=false,locked=false;
  try{
   if(household?.active&&remoteReady){
    household.busy=true;locked=true;const hid=household.active,result=await household.dataRpc('respond_proactive_suggestions',{hid,items:selected.map(s=>({name:s.name,kind:s.kind,fingerprint:s.fingerprint,action,unit:productUnit(s.name)}))});
    if(current!==scope()||epoch!==generation)return;remote=result.suggestions;feedback={...feedback,...M.cleanFeedback(result.feedback)};saved=true;
    if(action==='accepted'||action==='still_here'){const rows=await household.dataRead('household_records?household_id=eq.'+encodeURIComponent(hid)+'&select=bucket,key,value,revision');if(current!==scope()||epoch!==generation)return;household.rows=rows;state=HouseholdModel.decode(rows,state);localStorage.setItem(household.storageKey(),JSON.stringify(state));updateCount();await PantryReview.refresh()}
   }else{
    if(action==='accepted'){const plan=M.listPlan(state,selected,productUnit);if(plan.added.length&&!await saveVoiceState(plan.next))throw Error('Save');saved=true}
    if(current!==scope()||epoch!==generation)return;
    if(action==='still_here'){const next={...state,stock:{...state.stock}};selected.forEach(s=>{if(!(next.stock[s.name]>0))next.stock[s.name]=2});if(!await saveVoiceState(next))throw Error('Save');saved=true;if(current!==scope())return;if(!await PantryReview.confirm(selected.map(s=>s.name)))throw Error('Check')}
    if(current!==scope()||epoch!==generation)return;let nextFeedback=feedback;for(const s of selected)nextFeedback=M.respond(nextFeedback,s,action);localStorage.setItem(storage(),JSON.stringify(nextFeedback));feedback=nextFeedback;saved=true;
   }
   if(current!==scope()||epoch!==generation)return;selection.clear();
   toast(say(action==='accepted'?'A jóváhagyott tételek a listán vannak.':action==='still_here'?'Megjegyeztem: van még otthon.':action==='later'?'Rendben, 3 napig félreteszem.':'Rendben, egy hétig félreteszem.',action==='accepted'?'Your approved items are on the list.':action==='still_here'?'Noted: you still have it.':action==='later'?'Okay, set aside for 3 days.':'Okay, set aside for a week.'));
  }catch{if(current===scope())toast(say(saved?'A változás mentve; a visszajelzés vagy a frissítés még nem sikerült.':'Nem sikerült menteni, vagy közben változott a javaslat. Nézd át újra.',saved?'Your change was saved; feedback or refreshing the view is still pending.':'Could not save, or the suggestion changed. Please review it again.'))}
  finally{if(locked&&current===scope())household.busy=false;busy=false;if(current===scope()&&epoch===generation){requestedState='';loadedAt=0;render();refresh(true)}}
 }
 function saveRecipeFeedback(s,action){const next=M.respond(feedback,s,action);try{localStorage.setItem(storage(),JSON.stringify(next));feedback=next;return true}catch{toast(say('A visszajelzést nem sikerült menteni.','Could not save your feedback.'));return false}}
 async function openRecommendation(id){
  const s=recommendations().find(s=>s.recipeId===id);if(!s)return;const current=scope();
  try{const r=s.recipe.steps?s.recipe:await RecipeLibrary.get(s.recipeId);if(current!==scope())return;saveRecipeFeedback(s,'opened');RecipeRoom.open(r)}catch{toast(say('A recept most nem tölthető be. Próbáld újra.','Could not load this recipe. Try again.'))}
 }
 function bind(host){
  const images=host.querySelectorAll('[data-proactive-image]');if(images.length){const picks=recommendations();images.forEach(image=>{const s=picks.find(s=>s.recipeId===image.dataset.proactiveImage);if(s)window.RecipeImages?.mount(image,{...s.recipe,recipeId:s.recipeId},-1,{autoCreate:true,quiet:true})})}
  const offered=products();
  host.querySelectorAll('[data-proactive-action]').forEach(b=>b.onclick=()=>{const s=offered.find(x=>x.id===b.dataset.proactiveId);if(s)respond([s],b.dataset.proactiveAction)});
  host.querySelectorAll('[data-proactive-select]').forEach(b=>b.onchange=()=>{b.checked?selection.add(b.dataset.proactiveSelect):selection.delete(b.dataset.proactiveSelect);mount()});
  host.querySelector('[data-proactive-approve]')?.addEventListener('click',()=>respond(offered.filter(s=>selection.has(s.id)),'accepted'));
  host.querySelectorAll('[data-proactive-recipe]').forEach(b=>b.onclick=()=>openRecommendation(b.dataset.proactiveRecipe));
  host.querySelectorAll('[data-proactive-recipe-useful]').forEach(b=>b.onclick=()=>{const s=recommendations().find(s=>s.recipeId===b.dataset.proactiveRecipeUseful);if(s&&saveRecipeFeedback(s,'useful')){toast(say('Megjegyeztem, hogy ez az ötlet hasznos volt.','Noted: this idea was useful.'));mount();MorzsaCompanion?.updateNudge()}});
  host.querySelectorAll('[data-proactive-recipe-later]').forEach(b=>b.onclick=()=>{const s=recommendations().find(s=>s.recipeId===b.dataset.proactiveRecipeLater);if(s&&saveRecipeFeedback(s,'later')){toast(say('3 napig más ötleteket mutatok.','I’ll show other ideas for 3 days.'));mount();window.MorzsaCompanion?.updateNudge()}});
  host.querySelector('[data-proactive-overview]')?.addEventListener('click',()=>dashboardGo('overview'));
 }
 // A tab returns to its own conversation, filters, draft and scroll position.
 const nav=document.querySelector('nav');
 nav.addEventListener('click',e=>{const button=e.target.closest('[data-page]');if(!button)return;e.preventDefault();e.stopImmediatePropagation();sync();const destination=button.dataset.page;if(destination===page)return;
  positions.set(page,{scroll:scrollY,recipeQuery:main.querySelector('.recipe-feed-search input')?.value});page=destination;render();
  const prior=positions.get(page);requestAnimationFrame(()=>{const input=main.querySelector('.recipe-feed-search input');if(input&&prior?.recipeQuery!==undefined)input.value=prior.recipeQuery;window.scrollTo({top:prior?.scroll||0,behavior:'instant'})});
 },true);
 window.addEventListener('morzsa-auth-change',()=>{sync();mount()});
 window.addEventListener('morzsa-preferences-change',()=>{mount();MorzsaCompanion?.updateNudge()});
 window.addEventListener('storage',e=>{if(e.key===storage()){try{feedback=M.cleanFeedback(JSON.parse(e.newValue))}catch{}mount();MorzsaCompanion?.updateNudge()}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh(true);mount()}});
 setInterval(()=>{if(!document.hidden&&!busy){mount();MorzsaCompanion?.updateNudge()}},30000);
 queueMicrotask(()=>{sync();mount();MorzsaCompanion?.updateNudge()});
 return {mount,chat,refresh,products,recommendations,respond};
})();
