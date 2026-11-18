// Household presentation uses server records; it never creates a second list or pantry.
window.MorzsaHousehold=(()=>{
 const say=(hu,en)=>language==='en'?en:hu;
 let scope='',loaded=false,lastEvent=null,snapshot={members:[],events:[],cooking:[]};
 const current=()=>JSON.stringify([household?.userId(),household?.active]);
 function sync(){if(scope===current())return false;scope=current();loaded=false;lastEvent=null;snapshot={members:[],events:[],cooking:[]};return true}
 function actorName(id,name){sync();return id&&id===household?.userId()?say('Te','You'):name||snapshot.members.find(m=>m.user_id===id)?.name||say(id?'Konyhatag':'Konyhai változás',id?'Household member':'Household change')}
 function eventText(e){
  const verbs={stock_home:['készletre tette','added to the pantry'],stock_low:['kevésnek jelölte','marked as low'],stock_out:['elfogyottnak jelölte','marked as used up'],list_added:['hozzáadta a listához','added to the list'],list_updated:['módosította a listán','updated on the list'],list_checked:['kipipálta','picked up'],list_unchecked:['visszatette a szükségesek közé','marked as still needed'],list_removed:['levette a listáról','removed from the list'],shopping_completed:['befejezte a vásárlást','finished shopping'],recipe_started:['elkezdte a receptet','started the recipe'],recipe_completed:['elkészítette a receptet','finished the recipe'],preferences_updated:['frissítette a közös ízlést','updated the shared preferences']};
  const verb=verbs[e.event_type];if(!verb)return '';
  return actorName(e.actor_id,e.actor_name)+' '+say(...verb)+(e.subject?' · '+(['recipe_started','recipe_completed'].includes(e.event_type)?e.subject:displayName(e.subject)):e.event_type==='shopping_completed'?' · '+e.item_count+say(' tétel',' items'):'');
 }
 function update(value){
  sync();if(!Array.isArray(value?.members)||!Array.isArray(value?.cooking))return;
  const events=Array.isArray(value.events)?value.events:[],latest=events.reduce((max,e)=>Math.max(max,Number(e.id)||0),0);
  const incoming=lastEvent===null?[]:events.filter(e=>Number(e.id)>lastEvent&&e.actor_id!==household?.userId());
  snapshot={members:value.members,events,cooking:value.cooking};loaded=true;lastEvent=Math.max(lastEvent||0,latest);
  if(incoming.length){const message=eventText(incoming[0]);if(message)toast(message+(incoming.length>1?' · +'+(incoming.length-1):''))}
  main.querySelectorAll?.('[data-item-actor]').forEach(el=>el.textContent=actorName(el.dataset.itemActor)+say(el.dataset.authorKind==='bought'?' · Kipipálta':' · Hozzáadta',el.dataset.authorKind==='bought'?' · Picked up':' · Added'));mount();
 }
 function cookingMarkup(recipe){
  sync();if(!household?.active)return '';
  const entries=snapshot.cooking.filter(c=>c.actorId!==household.userId()&&(recipe?c.recipeId===recipe.recipeId:true));
  return entries.slice(0,recipe?2:3).map(c=>'<button type="button" class="household-cooking-row" data-household-cooking="'+esc(c.conversationId)+'"><img src="assets/ui/chef-hat.svg" alt="" width="20" height="20"><span><strong>'+esc(actorName(c.actorId,c.actorName))+(recipe?'':' · '+esc(c.title))+'</strong><small>'+esc(c.activity==='paused'?say('Szüneteltetett főzés','Cooking paused'):c.activity==='preparation'?say('A receptet készíti elő','Preparing this recipe'):say('Már főzi','Already cooking'))+(c.activity==='active'&&c.stepCount?' · '+(Number(c.step||0)+1)+'/'+c.stepCount+say('. lépés',' steps'):'')+'</small></span><span aria-hidden="true">→</span></button>').join('');
 }
 function bind(root){root?.querySelectorAll('[data-household-cooking]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await window.MorzsaPersistence?.refresh();if(!window.MorzsaCompanion?.openThread(b.dataset.householdCooking))throw Error('Unavailable')}catch{toast(say('A főzési előzmény nem tölthető be. Próbáld újra.','Cooking history could not load. Try again.'))}finally{b.disabled=false}})}
 function mount(){
  sync();const existing=main.querySelector('.household-cooking');if(!household?.active||!loaded||!['overview','recipes'].includes(page)){existing?.remove();return}
  const markup=cookingMarkup(page==='recipes'?window.RecipeRoom?.reading():null);if(!markup){existing?.remove();return}if(existing?.dataset.markup===markup)return;existing?.remove();const section=document.createElement('aside');section.className='household-cooking';section.dataset.markup=markup;section.setAttribute('data-no-translate','');section.innerHTML='<h2>'+say('A közös konyhában','In your shared kitchen')+'</h2>'+markup;
  const anchor=page==='recipes'?main.querySelector('.recipe-reading-hero,.room-heading'):main.querySelector('.daily-heading');if(anchor)anchor.after(section);bind(section);
 }
 const ownName=()=>{sync();return snapshot.members.find(m=>m.user_id===household?.userId())?.name||''};
 function nameField(){return '<label>'+say('Neved a közös konyhában','Your name in the shared kitchen')+'<input name="memberName" maxlength="60" autocomplete="nickname" value="'+esc(ownName())+'" placeholder="'+say('Pl. Peti','e.g. Alex')+'"></label>'}
 window.addEventListener('morzsa-household-change',()=>{sync();window.KitchenIntelligence?.refresh();window.RecipeLibrary?.refresh();window.MorzsaPersistence?.refresh()});
 window.addEventListener('morzsa-auth-change',sync);
 return {sync,update,mount,bind,cookingMarkup,actorName,eventText,nameField,ownName,ready:()=>{sync();return loaded}};
})();
