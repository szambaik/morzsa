// A shared presentation layer. Existing pantry/list/session handlers own mutations.
window.UnifiedWorkspace=(()=>{
 const say=(hu,en)=>language==='en'?en:hu,icon=name=>'<img src="assets/ui/'+name+'.svg" width="22" height="22" alt="">';
 const noteDrafts=new Map(),shoppingDrafts=new Map(),shoppingFolds=new Map();let variants=null;
 function openChat(origin,text=''){
  MorzsaCompanion.openContext(origin);
  const input=document.getElementById('companion-input');if(input&&text&&!input.value.trim()){input.value=text;input.dispatchEvent(new Event('input'));input.focus({preventScroll:true})}
 }
 function chat(){
  const root=main.querySelector('.companion');if(!root||document.body.classList.contains('workspace-cooking'))return;
  const heading=root.querySelector('.companion-heading>span');if(heading)heading.textContent=say('Morzsa · AI konyhai asszisztens','Morzsa · AI kitchen assistant');
  const cards=[...root.querySelectorAll('.companion-results .companion-recipe')],more=root.querySelector('[data-more-ideas]');if(more&&cards.length){const actions=cards.at(-1).querySelector('.companion-actions');if(actions&&more.parentElement!==actions)actions.append(more)}
 }
 function overview(){
  const host=main.querySelector('.dashboard');if(!host||host.dataset.unified)return;host.dataset.unified='true';
  host.querySelector('.daily-heading h1').textContent=say('Jó itt látni!','Good to see you!');host.querySelector('.daily-heading p').textContent=say('Nézzük, mi legyen ma, és mi érdemel figyelmet a háztartásban.','Let’s see what to cook and what needs attention at home.');host.querySelector('.daily-heading img')?.remove();
  const active=CookingSession.sessions(MorzsaCompanion.recipeThreads()).all[0];
  const hero=document.createElement('section');hero.className='unified-overview-hero';
  hero.innerHTML='<div><h2>'+say(active?'Folytasd a főzést':'Ma mit főzzünk?',active?'Continue cooking':'What shall we cook today?')+'</h2><p>'+esc(active?active.recipe.title:say('Kérdezd Morzsát, vagy nézz körül a receptek között.','Ask Morzsa, or explore your recipes.'))+'</p><button class="primary" data-unified-cook>'+say(active?'Főzés folytatása':'Kérdezd Morzsát',active?'Resume cooking':'Ask Morzsa')+icon('arrow-right')+'</button></div><img src="assets/recipe-page-reference/sidebar-mascot.webp" width="155" height="110" alt="">';
  host.querySelector('.daily-heading').after(hero);hero.querySelector('button').onclick=()=>active?MorzsaCompanion.openThread(active.id):openChat('overview',say('Mit főzzünk ma a meglévő alapanyagokból?','What should we cook with what we have?'));
  const counts=host.querySelector('.daily-counts');if(counts){counts.classList.add('unified-overview-tasks');const buttons=[...counts.querySelectorAll('button')],refill=KitchenModel.replenishment(state),pending=state.cart.filter(i=>!i.done).length;
   const copy=[[say('Készlet','Pantry'),say('Nézd meg, miből főzhetünk.','See what we can cook with.'),'house'],[say('Érdemes ránézni','Worth a look'),refill.length?say(refill.length+' alapanyag fogyóban vagy elfogyott.',refill.length+' ingredients low or used up.'):say('Most nincs jelzett hiány.','No shortages flagged.'),'check'],[say('Következő bevásárlás','Next shopping trip'),pending?say(pending+' tétel vár a listán.',pending+' items on your list.'):say('Írd fel, amire szükségetek lesz.','List what you will need.'),'shopping-cart']];
   buttons.forEach((b,i)=>b.innerHTML=icon(copy[i][2])+'<span><strong>'+copy[i][0]+'</strong><small>'+copy[i][1]+'</small></span>'+icon('chevron-right'));
  }
 }
 function contextualCard(origin){
  let host=main.querySelector('.unified-context-card');if(host)return;
  host=document.createElement('button');host.className='unified-context-card';host.type='button';
  const pantry=origin==='pantry';host.innerHTML=icon('sparkles')+'<span><strong>'+say(pantry?'Kérdezd Morzsát a készletről':'Morzsa segít a bevásárlásban',pantry?'Ask Morzsa about your pantry':'Morzsa helps with shopping')+'</strong><small>'+say(pantry?'Mit főzhetek a meglévő alapanyagokból?':'Mi hiányzik a következő fogáshoz?',pantry?'What can I cook with what I have?':'What is missing for our next meal?')+'</small></span>'+icon('arrow-right');host.onclick=()=>openChat(origin,say(pantry?'Mit főzhetek a meglévő alapanyagokból?':'Segíts átnézni a bevásárlólistát és a készletünket.',pantry?'What can I cook with the ingredients at home?':'Help me review our shopping list and pantry.'));main.append(host);
 }
 function shopping(){
  const heading=main.querySelector('.pantry-heading');if(!heading||main.querySelector('.shopping-mode-screen'))return;
  if(!main.querySelector('.unified-list-tabs')){
   const tabs=document.createElement('div');tabs.className='unified-list-tabs';tabs.innerHTML='<button aria-pressed="true">'+say('Aktuális lista','Current list')+'</button><button>'+say('Korábbi listák','Previous lists')+'</button>';heading.after(tabs);tabs.children[1].onclick=()=>openArchive();
   const summary=document.createElement('div');summary.className='unified-list-summary';const pending=state.cart.filter(i=>!i.done).length;
   summary.innerHTML='<div>'+icon('shopping-cart')+'<strong>'+pending+say(' tétel',' items')+'</strong></div><button data-unified-start>'+icon('shopping-cart')+say('Vásárlási mód','Shopping mode')+'</button>';tabs.after(summary);summary.querySelector('button').onclick=()=>ShoppingMode.start();
   const estimate=main.querySelector('.shopping-price-summary');if(estimate)summary.firstElementChild.append(estimate);
   const add=document.createElement('form');add.className='unified-list-add';add.innerHTML='<button type="button" aria-label="'+say('Tétel hozzáadása','Add item')+'">'+icon('plus')+'</button><input type="text" maxlength="2000" aria-label="'+say('Új tétel a listára','New shopping item')+'" placeholder="'+say('Tétel hozzáadása (pl. paradicsom, tej…)','Add an item (e.g. tomatoes, milk…)')+'"><button type="submit" aria-label="'+say('Hozzáadás','Add')+'">'+icon('arrow-up')+'</button>';main.append(add);add.onsubmit=e=>{e.preventDefault();MorzsaWorkspace.quick('cart',add.querySelector('input').value)};add.firstElementChild.onclick=()=>MorzsaWorkspace.quick('cart',add.querySelector('input').value);
  }
  if(!main.querySelector('.unified-list-intro')){const intro=document.createElement('p');intro.className='unified-list-intro';intro.textContent=say(household?.active?'Közös lista a háztartásotoknak.':'A következő bevásárláshoz.',household?.active?'A shared list for your household.':'For your next shopping trip.');heading.after(intro)}
  const scope=voiceContext(),groups=[...main.querySelectorAll('.shopping-group')];let folds=shoppingFolds.get(scope);if(!folds){folds=new Map(groups.map((g,i)=>[g.dataset.category,i===0]));shoppingFolds.set(scope,folds)}
  for(const g of groups){if(g.dataset.unifiedFold)continue;g.dataset.unifiedFold='true';g.open=folds.get(g.dataset.category)??false;g.addEventListener('toggle',()=>{if(g.isConnected)folds.set(g.dataset.category,g.open)})}
  const add=main.querySelector('.unified-list-add'),input=add?.querySelector('input');if(input){input.value=shoppingDrafts.get(scope)||'';input.oninput=()=>shoppingDrafts.set(scope,input.value);const submit=()=>{MorzsaWorkspace.quick('cart',input.value.trim()?input.value:undefined);if(document.getElementById('workspace-entry')?.open){shoppingDrafts.delete(scope);input.value=''}};add.onsubmit=e=>{e.preventDefault();submit()};add.firstElementChild.onclick=submit;}
  contextualCard('shopping');
 }
 function pantry(){const heading=main.querySelector('.pantry-library .pantry-heading');if(!heading)return;contextualCard('pantry');}
 function recipe(){
  const root=main.querySelector('.recipe-cooking-page');if(!root||root.dataset.unified)return;root.dataset.unified='true';
  if(root.classList.contains('is-reading')){
   const mainColumn=root.querySelector('.rc-main'),profile=root.querySelector('.rc-profile'),hero=document.createElement('div');hero.className='unified-recipe-hero';const cover=document.createElement('div');cover.className='unified-recipe-cover';cover.append(profile.querySelector('.rc-photo'),profile.querySelector('.rc-heart'));hero.append(cover);
   for(const selector of ['h1','.rc-description','.rc-meta']){const node=profile.querySelector(selector);if(node)hero.append(node)}mainColumn.prepend(hero);const ask=document.createElement('button');ask.className='unified-cooking-ask';ask.innerHTML=icon('message-circle')+say('Kérdezz erről Morzsától','Ask Morzsa about this recipe');ask.onclick=()=>MorzsaCompanion.openRecipeChat(RecipeRoom.reading());root.querySelector('.rc-side').append(ask);
   const tabs=document.createElement('div');tabs.className='unified-recipe-tabs';tabs.innerHTML=[['method','Recept','Recipe'],['ingredients','Hozzávalók','Ingredients'],['tips','Tippek','Tips'],['variants','Variációk','Variations']].map(([key,hu,en])=>'<button data-recipe-section="'+key+'" aria-pressed="'+(key==='method')+'">'+say(hu,en)+'</button>').join('');hero.after(tabs);
   tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    if(b.dataset.recipeSection==='variants'){showVariants(root);return}
    if(b.dataset.recipeSection==='ingredients'){root.querySelector('[data-cooking-ingredients]').click();return}
    if(b.dataset.recipeSection==='tips'&&matchMedia('(max-width:767px)').matches){root.querySelector('[data-cooking-ingredients]').click();requestAnimationFrame(()=>document.querySelector('#recipe-ingredients-panel .rc-tips')?.scrollIntoView({block:'start'}));return}const target=root.querySelector(b.dataset.recipeSection==='tips'?'.rc-tips':'.rc-method-heading');if(target?.tagName==='DETAILS')target.open=true;target?.scrollIntoView({block:'center',behavior:'smooth'});
   });
  }else{
   const side=root.querySelector('.rc-side'),button=document.createElement('button');button.className='unified-cooking-ask';button.innerHTML=icon('message-circle')+say('Kérdezz Morzsától','Ask Morzsa');button.onclick=()=>root.querySelector('[data-open-cooking-question]')?.click();side.append(button);
   const ingredients=root.querySelector('.rc-side .rc-ingredients');if(ingredients&&ingredients.querySelectorAll('[data-rc-check]').length>6){const all=document.createElement('button');all.className='unified-all-ingredients';all.textContent=say('Összes hozzávaló','All ingredients');all.onclick=()=>root.querySelector('[data-cooking-ingredients]')?.click();ingredients.append(all)}
   const context=MorzsaCompanion.composerContext(),id=JSON.parse(context)[2],t=MorzsaCompanion.recipeThreads().find(t=>t.id===id);if(!t)return;
   const panel=root.querySelector('.rc-timer-panel');if(panel){panel.hidden=!t.cooking?.timers?.some(x=>!x.cancelled&&!x.acknowledged)&&!panel.querySelector('details')?.open;root.querySelector('[data-rc-timers]')?.addEventListener('click',()=>{panel.hidden=false;panel.scrollIntoView({block:'center',behavior:'smooth'});panel.querySelector('input')?.focus({preventScroll:true})})}
   const notes=document.createElement('label');notes.className='unified-cooking-notes';notes.innerHTML='<strong>'+icon('square-pen')+say('Jegyzet','Notes')+'</strong><textarea rows="3" maxlength="1000" aria-label="'+say('Főzési jegyzet','Cooking notes')+'" placeholder="'+say('Saját megjegyzés…','Your notes…')+'" '+(t.readOnly?'disabled':'')+'></textarea><small role="status"></small>';side.append(notes);const input=notes.querySelector('textarea');input.value=noteDrafts.get(context)??t.cooking?.feedback?.notes??'';
   input.oninput=()=>noteDrafts.set(context,input.value);input.onchange=()=>{if(context!==MorzsaCompanion.composerContext())return;if(MorzsaCompanion.saveCookingNote(input.value)){noteDrafts.delete(context);notes.querySelector('small').textContent=say('Mentve','Saved')}else notes.querySelector('small').textContent=say('Mentésre vár ezen az eszközön.','Waiting to save on this device.')};side.append(button);
  }
 }
 function showVariants(root){
  variants?.remove();variants=document.createElement('dialog');variants.className='unified-variants-dialog';variants.innerHTML='<button data-close aria-label="'+say('Bezárás','Close')+'">'+icon('x')+'</button><h2>'+say('Milyen legyen ez a fogás?','How would you like this dish?')+'</h2>'+RecipeDiscoveryUI.variants('data-unified-variant');variants.querySelector('details').open=true;document.body.append(variants);variants.querySelector('[data-close]').onclick=()=>variants.close();const r=RecipeRoom.reading();variants.querySelectorAll('[data-unified-variant]').forEach(b=>b.onclick=()=>{variants.close();if(root.isConnected&&r)MorzsaCompanion.variant(r,b.dataset.unifiedVariant)});variants.showModal();
 }
 function mount(){
  document.body.classList.add('unified-shell');document.body.dataset.workspacePage=page;const brand=document.querySelector('.recipe-sidebar-brand');if(brand&&!brand.dataset.unifiedBrand){brand.dataset.unifiedBrand='true';brand.innerHTML='<img class="unified-brand-mark" src="assets/brands/morzsa.svg" alt="" width="29" height="29"><strong>Morzsa</strong>'}
  if(variants?.open&&!main.querySelector('.recipe-cooking-page.is-reading'))variants.close();
  if(page==='chat')chat();if(page==='overview')overview();if(page==='shopping')shopping();if(page==='pantry')pantry();if(page==='recipes'&&!RecipeRoom.reading()&&!main.querySelector('.unified-recipes-chat')){const button=document.createElement('button');button.className='unified-recipes-chat';button.innerHTML=icon('message-circle')+say('Kérdezz új receptötletet Morzsától','Ask Morzsa for a new recipe idea');button.onclick=()=>openChat('recipes',say('Adj új receptötleteket a készletünkből.','Suggest new recipes using our pantry.'));main.append(button)}recipe();
 }
 window.addEventListener('morzsa-auth-change',()=>{noteDrafts.clear();shoppingDrafts.clear();shoppingFolds.clear();variants?.close()});
 return {mount,openChat};
})();
