// A separate scroll surface keeps the recipe at its current reading position.
window.RecipeIngredientsPanel=(()=>{
 const say=(hu,en)=>language==='en'?en:hu;
 const dialog=document.createElement('dialog');dialog.id='recipe-ingredients-panel';
 dialog.setAttribute('aria-labelledby','ingredients-panel-title');dialog.setAttribute('data-no-translate','');document.body.append(dialog);
 let session=null;
 const properties=['position','top','left','right','width','overflow'];
 function close(){if(dialog.open)dialog.close();restore()}
 function restore(){
  const previous=session;if(!previous)return;session=null;
  for(const [name,value,priority] of previous.styles)document.body.style.setProperty(name,value,priority);
  document.documentElement.style.setProperty('scroll-behavior','auto');
  window.scrollTo(previous.x,previous.y);
  if(previous.focus?.isConnected)previous.focus.focus({preventScroll:true});
  document.documentElement.style.setProperty('scroll-behavior',previous.behavior,previous.behaviorPriority);
  dialog.replaceChildren();
 }
 let gestures=false;
 dialog.addEventListener('close',()=>{if(!dialog.open)restore()});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()});
 function fillChecklist(recipe,options){
  const t=options.checklistThread;
  const host=dialog.querySelector('.ingredients-panel-content');if(!host)return;
  const tips=RecipeCookingPage.tips(t);
  host.innerHTML=RecipeCookingPage.ingredients(t)+(tips.length?'<details class="rc-tips" open><summary>'+say('Tippek','Tips')+'</summary><ul>'+tips.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></details>':'');
  host.insertAdjacentHTML('beforeend','<details class="rc-availability-details"><summary>'+say('Készlet és bevásárlólista','Pantry and shopping list')+'</summary><div data-rc-availability></div></details>');RecipeRoom.mount(host.querySelector('[data-rc-availability]'),recipe,{...options,ingredientsOnly:true,hidePortions:true});
  RecipeCookingPage.bindChecklist(host,t,{onPortions:next=>{
   options.checklistThread={...t,portions:next};options.portions=next;options.onPortions?.(next);
   if(dialog.open)fillChecklist(recipe,options);
  }});
 }
 function open(recipe,options={}){
  if(dialog.open){if(session?.valid?.()===false)close();else return}
  if(options.valid?.()===false)return;
  session={x:scrollX,y:scrollY,focus:document.activeElement,valid:options.valid,styles:properties.map(n=>[n,document.body.style.getPropertyValue(n),document.body.style.getPropertyPriority(n)]),behavior:document.documentElement.style.getPropertyValue('scroll-behavior'),behaviorPriority:document.documentElement.style.getPropertyPriority('scroll-behavior')};
  dialog.innerHTML='<div class="ingredients-panel-head"><div><h2 id="ingredients-panel-title">'+say('Hozzávalók','Ingredients')+'</h2><p>'+esc(recipe.title)+'</p></div><button type="button" data-ingredients-close aria-label="'+say('Vissza a recepthez','Back to recipe')+'">×</button></div><div class="ingredients-panel-scroll"><div class="ingredients-panel-content"></div></div>';
  dialog.classList.toggle('recipe-checklist-sheet',!!options.checklistThread);if(options.checklistThread)fillChecklist(recipe,options);else RecipeRoom.mount(dialog.querySelector('.ingredients-panel-content'),recipe,{...options,ingredientsOnly:true,hidePortions:true});
  dialog.querySelector('[data-ingredients-close]').onclick=close;
  Object.assign(document.body.style,{position:'fixed',top:-session.y+'px',left:'0',right:'0',width:'100%',overflow:'hidden'});
  dialog.showModal();if(!gestures&&typeof PanelGestures!=='undefined'){PanelGestures.bind(dialog,{axis:'y',disabled:()=>!dialog.classList.contains('recipe-checklist-sheet')||!matchMedia('(max-width:767px)').matches});gestures=true}dialog.querySelector('[data-ingredients-close]').focus({preventScroll:true});
 }
 function check(){if(dialog.open&&session?.valid?.()===false)close()}
 window.addEventListener('morzsa-auth-change',close);
 return {open,close,check};
})();
