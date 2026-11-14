let state={stock:{},custom:[],cart:[],likes:[],skips:[],chats:{},history:[]};
try{const saved=JSON.parse(localStorage.getItem('morzsa-v2')||localStorage.getItem('morzsa-v1'));if(saved&&saved.stock&&Array.isArray(saved.cart)&&Array.isArray(saved.likes))state={...state,...saved}}catch{}
if(!Array.isArray(state.history))state.history=[];
// Promote previously typed shopping items into the persistent custom category.
for(const item of state.cart)if(![...catalog,...state.custom].some(x=>x.name.toLocaleLowerCase('hu')===item.name.toLocaleLowerCase('hu')))state.custom.push({name:item.name,emoji:'🫙',category:'Saját tételek'});
const homeUndo=[];
let homeUndoTimer;
let shoppingDraft='',pantryDraft='';
let pantryBatch=[],pantryListed=new Set();
let page='chat',category='Minden',stockView='home',search='' ,showSaved=false,currentId=null;const main=document.getElementById('main'),dialog=document.getElementById('detail');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem(window.household?.storageKey()||'morzsa-v2',JSON.stringify(state))}catch{toast('A böngésző nem engedte a mentést.')}updateCount();window.PantryReview?.onStateChanged();window.household?.notify()}
function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2300)}
function updateCount(){document.getElementById('cart-count').textContent=state.cart.filter(x=>!x.done).length||''}
function productCategory(name){return [...catalog,...state.custom].find(i=>i.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu'))?.category||'Saját tételek'}
function productUnit(name){
 const overrides={'Krumpli':'kg','Édesburgonya':'kg','Hagyma':'kg','Sárgarépa':'kg','Alma':'kg','Barack':'kg','Banán':'kg','Fokhagyma':'db','Paprika':'db','Paradicsom':'db','Uborka':'db','Cukkini':'db','Padlizsán':'db','Citrom':'db','Lime':'db','Avokádó':'db','Tojás':'db','Tej':'l','Olaj':'l','Olívaolaj':'üveg','Vaj':'csomag','Tejszín':'doboz','Joghurt':'pohár','Sajtkrém':'doboz','Tejföl':'pohár','Rizs':'kg','Jázminrizs':'kg','Liszt':'kg','Cukor':'kg','Csirkecomb':'kg','Csirkemell':'kg','Szalonna':'csomag','Fogkrém':'db','Fogkefe':'db','Szájvíz':'üveg','Cumisüveg':'db','Cumi':'db','Száraz kutyaeledel':'kg','Száraz macskaeledel':'kg','Nedves kutyaeledel':'doboz','Nedves macskaeledel':'doboz','Szemetesvödör':'db','Ételtároló doboz':'db'};
 if(overrides[name])return overrides[name];
 const c=productCategory(name);return {'Zöldségek':'db','Gyümölcsök':'db','Hús és felvágott':'kg','Hal és tengeri':'kg','Konzervek és hüvelyesek':'doboz','Italok':'üveg','Szószok és olajok':'üveg','Fűszerek':'csomag','Tejtermék és tojás':'csomag','Háztartás':'csomag','Tisztálkodás és szépségápolás':'db','Fogápolás és higiénia':'csomag','Otthoni apróságok':'db','Takarítás és mosás':'db','Sör, bor és szeszes italok':'üveg','Lekvárok és kenhető krémek':'üveg','Készételek és gyors fogások':'doboz'}[c]||'csomag';
}
function cartAmount(x){return (x.quantity||1)+' '+(x.unit||productUnit(x.name))}
function addCart(name,source='Készlet',quantity=1,unit=null){
 name=[...catalog,...state.custom].find(i=>i.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu')||(productEnglish[i.name]||'').toLowerCase()===name.toLowerCase())?.name||name;
 const found=state.cart.find(x=>x.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu')),chosenUnit=unit||(!found?.done&&found?.unit)||productUnit(name);
 if(found){if(found.done){found.done=false;found.quantity=quantity;found.unit=chosenUnit}else{if(found.unit&&found.unit!==chosenUnit){toast('Eltérő egység: módosítsd a mennyiséget a listán.');return false}found.quantity=(found.quantity||1)+quantity;found.unit=chosenUnit}}
 else state.cart.push({name,source,quantity,unit:chosenUnit,done:false});if(![...catalog,...state.custom].some(x=>x.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu')))state.custom.push({name,emoji:'🫙',category:'Saját tételek'});save();basketFeedback(name);return true;
}
function openQuantity(name,edit=false){
 const existing=state.cart.find(x=>x.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu')),q=document.getElementById('quantity-dialog');edit=!!existing;let quantity=existing?.quantity||1;
 q.innerHTML='<button class="close" aria-label="Mennyiségválasztó bezárása">×</button><div class="eyebrow">'+(edit?'A LISTÁDON':'LISTÁHOZ ADÁS')+'</div><h2>'+esc(name)+'</h2><p class="quantity-caption">'+(edit?'A listán szereplő teljes mennyiség:':'Mennyit szeretnél a listára tenni?')+'</p><div class="quantity-presets">'+[1,2,3,5].map(n=>'<button data-quantity="'+n+'" aria-pressed="'+(quantity===n)+'">'+n+'</button>').join('')+'</div><div class="quantity-fields"><label>Egységek<input id="quantity-number" type="number" min="1" max="999" step="any" value="'+quantity+'" inputmode="numeric"></label><label>Egység<select id="quantity-unit">'+['db','kg','g','l','ml','csomag','doboz','üveg','pohár'].map(u=>'<option value="'+u+'" '+((existing?.unit||productUnit(name))===u?'selected':'')+'>'+u+'</option>').join('')+'</select></label></div><p class="quantity-total" aria-live="polite"></p><p class="quantity-error" role="alert"></p><button class="primary full" id="quantity-confirm">'+(edit?'Mennyiség mentése':'Hozzáadom')+'</button>';
 const input=q.querySelector('#quantity-number'),unit=q.querySelector('#quantity-unit');
 const update=()=>{q.querySelector('.quantity-total').textContent=input.value+' '+unit.value;q.querySelectorAll('[data-quantity]').forEach(b=>b.setAttribute('aria-pressed',String(Number(input.value)===Number(b.dataset.quantity))))};
 q.querySelectorAll('[data-quantity]').forEach(b=>b.onclick=()=>{input.value=b.dataset.quantity;update()});input.oninput=update;unit.onchange=update;q.querySelector('.close').onclick=()=>q.close();
 if(existing&&window.ShoppingMode){const remove=document.createElement('button');remove.className='small-button full quantity-remove';remove.type='button';remove.textContent=language==='en'?'Remove from list':'Eltávolítás a listáról';remove.onclick=()=>ShoppingMode.remove(existing.name);q.append(remove)}
 q.querySelector('#quantity-confirm').onclick=()=>{const n=Number(input.value);if(!Number.isFinite(n)||n<1||n>999){q.querySelector('.quantity-error').textContent='1 és 999 közötti számot adj meg.';return}if(existing){const current=state.cart.find(x=>x.name===existing.name);if(!current){q.querySelector('.quantity-error').textContent='A tétel közben lekerült a listáról.';return}const next={...state,cart:state.cart.map(x=>x===current?{...x,quantity:n,unit:unit.value}:x)};if(!saveShoppingState(next)){q.querySelector('.quantity-error').textContent='Nem sikerült menteni. Próbáld újra.';return}}else if(!addCart(name,'Készlet',n,unit.value))return;q.close();toast(name+' · '+n+' '+unit.value);if(page==='pantry')refreshCatalog();else refreshShoppingRows()};
 if(existing&&!window.ShoppingMode){const remove=document.createElement('button');remove.className='quantity-remove full';remove.textContent=language==='en'?'Remove from shopping list':'Eltávolítás a listáról';remove.onclick=()=>{const before=state,ctx=voiceContext(),next={...state,cart:state.cart.filter(x=>x.name!==name)};if(!saveShoppingState(next)){q.querySelector('.quantity-error').textContent=language==='en'?'Could not save. Try again.':'Nem sikerült menteni. Próbáld újra.';return}q.close();refreshShoppingRows();if(page==='pantry')refreshCatalog();showVoiceUndo(CompanionModel.changes(before,next),ctx)};q.append(remove)}
 update();q.showModal();
}
function bindAddButton(button,name){
 let timer=null,held=false,start=null;
 const cancel=()=>{clearTimeout(timer);timer=null};
 button.addEventListener('pointerdown',e=>{if(e.button!==0)return;held=false;start=[e.clientX,e.clientY];timer=setTimeout(()=>{held=true;openQuantity(name)},450)});
 button.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start[0],e.clientY-start[1])>10)cancel()});
 button.addEventListener('pointerup',cancel);button.addEventListener('pointercancel',cancel);button.addEventListener('pointerleave',cancel);
 button.addEventListener('contextmenu',e=>{e.preventDefault();cancel();if(!held){held=true;openQuantity(name)}});
 button.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&e.altKey){e.preventDefault();cancel();openQuantity(name)}else if(e.key==='Enter'||e.key===' '){held=false}});button.setAttribute('aria-keyshortcuts','Alt+ArrowDown');
 button.onclick=()=>{cancel();if(held){held=false;return}const found=state.cart.find(x=>x.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu'));if(found){if(commitState({...state,cart:state.cart.filter(x=>x!==found)})){toast(name+' lekerült a listáról.');refreshCatalog()}}else if(addCart(name)){toast(name+' a listára került.');refreshCatalog()}};
}
function missing(r){return r.ingredients.filter(([n])=>!state.stock[n])}
function score(r){const liked=recipes.filter(x=>state.likes.includes(x.id));return (r.ingredients.length-missing(r).length)/r.ingredients.length*10+liked.reduce((sum,x)=>sum+r.tags.filter(t=>x.tags.includes(t)).length,0)*.5-(window.KitchenIntelligence?.recentTitles().includes(r.name)?2:0)}
function nextRecipe(){return [...recipes].filter(r=>!state.likes.includes(r.id)&&!state.skips.includes(r.id)).sort((a,b)=>score(b)-score(a))[0]}
function hero(label,title,desc){return '<section class="hero"><div class="eyebrow">'+label+'</div><h1>'+title+'</h1><p class="subtitle">'+desc+'</p></section>'}
function render(){window.MorzsaCompanion?.onNavigate();document.querySelector('.app').dataset.page=page;document.body.classList.toggle('shopping-mode',page==='shopping'&&!!window.ShoppingMode?.visible());document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false')});updateCount();if(page==='chat')window.MorzsaCompanion?.render();if(page==='pantry')renderPantry();if(page==='overview')renderDashboard();if(page==='recipes')renderRecipes();if(page==='shopping')renderShopping();showHomeUndo();window.MorzsaWorkspace?.mount()}
const houseIcon='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9"/></svg>';
let categoryPage=0,categoryOffset=0,pantrySearchOpen=false,sortMode=state.sortMode==='alpha'?'alpha':'importance';
function compareProducts(a,b){return sortMode==='alpha'?displayName(a.name).localeCompare(displayName(b.name),language):(householdPriority.get(a.name)??9999)-(householdPriority.get(b.name)??9999)||displayName(a.name).localeCompare(displayName(b.name),language)}
function categoryIcon(name){const key=({'Zöldségek':'carrot','Gyümölcsök':'peach','Tejtermék és tojás':'milk','Hús és felvágott':'chicken','Fűszerek':'paprika','Italok':'tea','Háztartás':'cleaner','Saját tételek':'oats'})[name]||familyArtwork[name]||'oats';return '<img class="category-artwork" src="assets/icons/'+key+'.webp" alt="" width="28" height="28">'}
function basketFeedback(name){
 const basket=document.querySelector('.shopping-nav');basket.classList.remove('basket-bump');void basket.offsetWidth;basket.classList.add('basket-bump');clearTimeout(basketFeedback.timer);basketFeedback.timer=setTimeout(()=>basket.classList.remove('basket-bump'),600);
 // The pantry rerenders after an addition; animate the replacement button.
 if(name)requestAnimationFrame(()=>{const button=[...main.querySelectorAll('[data-basket]')].find(b=>b.dataset.basket===name);if(!button?.classList.contains('selected'))return;button.classList.remove('just-added');void button.offsetWidth;button.classList.add('just-added');setTimeout(()=>button.classList.remove('just-added'),600)});
}
function renderPantry(){
 if(stockView==='home'&&category!=='Minden'&&![...catalog,...state.custom].some(i=>i.category===category&&state.stock[i.name]>0))category='Minden';
 const all=[...catalog,...state.custom.filter(item=>!catalog.some(c=>c.name.toLocaleLowerCase('hu')===item.name.toLocaleLowerCase('hu')))],norm=s=>s.toLocaleLowerCase('hu').normalize('NFD').replace(/[̀-ͯ]/g,''),hasCart=n=>state.cart.some(x=>x.name===n);
 const matchingItems=()=>all.filter(i=>(search.trim()||category==='Minden'||i.category===category)&&(stockView!=='home'||state.stock[i.name]>0)&&(norm(i.name).includes(norm(search.trim()))||norm(productEnglish[i.name]||'').includes(norm(search.trim())))).sort(compareProducts);
 const cats=['Minden',...categoryPriorityOrder.filter(c=>catalogGroups.some(g=>g[0]===c)),...(state.custom.length?['Saját tételek']:[])];
 main.innerHTML='<div class="pantry-heading"><h1>'+(stockView==='home'?'Van otthon':'Készlet')+'</h1><span>'+all.filter(i=>state.stock[i.name]>0).length+' otthon</span></div><div class="catalog-search-row"><div class="search-wrap"><span aria-hidden="true">⌕</span><input id="catalog-search" type="search" aria-label="Keresés az alapanyagok között" placeholder="Mit keresel?" value="'+esc(search)+'"></div><button id="sort-toggle" class="sort-toggle" aria-label="'+(sortMode==='alpha'?'Rendezés: ABC. Váltás fontossági sorrendre.':'Rendezés: fontosság. Váltás ABC-sorrendre.')+'" aria-pressed="'+(sortMode==='alpha')+'">'+(sortMode==='alpha'?'ABC':'★')+'<span aria-hidden="true">↕</span></button></div><div class="catalog-layout"><aside class="category-rail" aria-label="Alapanyag-kategóriák"><button data-home-view aria-label="Van otthon nézet" aria-pressed="'+(stockView==='home')+'" class="home-view '+(stockView==='home'?'active':'')+'"><span aria-hidden="true">'+houseIcon+'</span><span>Van otthon</span></button>'+cats.map(c=>{const g=catalogGroups.find(g=>g[0]===c),icon=c==='Minden'?'▦':categoryIcon(c);const label=({'Gyümölcsök':'Gyümölcs','Hús és felvágott':'Húsok','Hal és tengeri':'Halak','Tejtermék és tojás':'Tej és tojás','Növényi alapok':'Növényi','Rizs és tészta':'Rizs, tészta','Konzervek és hüvelyesek':'Konzervek','Szószok és olajok':'Szósz, olaj','Sütés és édesség':'Sütés','Reggeli és rágcsálnivaló':'Reggeli','Saját tételek':'Saját','Lekvárok és kenhető krémek':'Lekvár, méz','Magvak és rágcsálnivalók':'Magvak, nasi','Készételek és gyors fogások':'Készételek','Sör, bor és szeszes italok':'Sör, bor','Takarítás és mosás':'Takarítás','Papír és konyhai kellékek':'Papír, konyha','Tisztálkodás és szépségápolás':'Testápolás','Fogápolás és higiénia':'Higiénia','Baba és kisgyerek':'Baba','Állateledel és kellékek':'Kisállat','Otthoni apróságok':'Otthon'})[c]||c;const active=stockView!=='home'&&category===c;return '<button data-rail-category="'+esc(c)+'" aria-label="Kategória: '+esc(c)+'" aria-pressed="'+active+'" class="'+(active?'active':'')+'"><span aria-hidden="true">'+icon+'</span><span>'+label+'</span></button>'}).join('')+'</aside><div class="catalog-content"><div id="catalog-results">'+catalogRows(matchingItems(),hasCart)+'</div></div></div><form class="add-form" id="add-item"><input aria-label="Új alapanyag" placeholder="Saját tétel hozzáadása…" maxlength="60" required><button aria-label="Alapanyag hozzáadása">+</button></form>';
 const tools=document.createElement('details');tools.className='pantry-tools';tools.innerHTML='<summary aria-label="Készlet műveletek">···</summary><button class="small-button" id="clear-stock">Készlet ürítése</button>';main.querySelector('.pantry-heading').append(tools);tools.querySelector('button').onclick=confirmClearStock;
 showHomeUndo();
 setupPantryNavigation();
 main.querySelector('[data-home-view]')?.addEventListener('click',()=>{stockView='home';category='Minden';search='';renderPantry()});
 main.querySelectorAll('[data-rail-category]').forEach(b=>b.onclick=()=>{category=b.dataset.railCategory;stockView='all';search='';collapsedCategories.delete(category);renderPantry();window.scrollTo({top:0,behavior:'instant'})});
 main.querySelector('#sort-toggle').onclick=()=>{sortMode=sortMode==='alpha'?'importance':'alpha';state.sortMode=sortMode;save();renderPantry()};
 bindCatalog();
}
const collapsedCategories=new Set();
function ingredientCard(i,hasCart){
 const home=state.stock[i.name]>0,basket=hasCart(i.name),say=(hu,en)=>language==='en'?en:hu;
 const basketIcon=document.querySelector('.shopping-nav-icon').innerHTML;
 return '<div class="ingredient-card '+(home?'at-home':'')+' '+(basket?'in-cart':'')+'" data-ingredient="'+esc(i.name)+'">'
  +'<div class="ingredient-center" data-card-drag="'+esc(i.name)+'"><span class="ingredient-icon" aria-hidden="true"><img class="product-artwork" src="'+(productArtwork[i.name]||'assets/icons/oats.webp')+'" alt="" draggable="false" width="40" height="40"></span><span class="ingredient-copy"><span class="ingredient-name" data-no-translate>'+esc(displayName(i.name))+'</span></span></div>'
  +'<button class="ingredient-plus '+(basket?'selected':'')+'" data-basket="'+esc(i.name)+'" data-no-translate aria-label="'+esc(displayName(i.name))+': '+say(basket?'listán van, eltávolítás':'hozzáadás a listához',basket?'on your list, remove':'add to shopping list')+'" aria-pressed="'+basket+'" aria-description="'+say('Hosszan nyomva a teljes mennyiséget állíthatod','Hold to change the total quantity')+'">'+basketIcon+'<span>'+say(basket?'Listán':'Listára',basket?'Listed':'To list')+'</span></button>'
  +'<button class="home-action '+(home?'selected':'')+'" data-home="'+esc(i.name)+'" data-no-translate aria-label="'+esc(displayName(i.name))+': '+say(home?'otthon van, kivétel a készletből':'készlethez adás',home?'at home, remove from pantry':'add to pantry')+'" aria-pressed="'+home+'">'+(home?'<span class="stock-remove-mark" aria-hidden="true">−</span>':'<span class="stock-add-mark" aria-hidden="true">+</span>')+'<span>'+say(home?'Elfogyott':'Készlet',home?'Used up':'Pantry')+'</span></button></div>';
}
function catalogRows(items,hasCart){
 if(!items.length&&stockView==='home'&&!search)return '<div class="empty pantry-empty" data-no-translate><img src="assets/illustrations/morzsa-mascot.webp" width="100" height="80" alt=""><h2>'+(language==='en'?'What is in your kitchen?':'Mi lapul a konyhádban?')+'</h2><p>'+(language==='en'?'Mark a few things you have at home. Your pantry will take shape here.':'Jelölj be néhány dolgot, ami van otthon. Itt áll majd össze a készleted.')+'</p><button class="primary" data-empty-add>'+(language==='en'?'Add the first items':'Első alapanyagok felvétele')+'</button></div>';
 if(!items.length)return '<div class="empty" data-no-translate>'+(stockView==='home'&&!search?(language==='en'?'Your pantry is empty. Use Search / add below to mark what you have at home.':'Még üres a készleted. A lenti Keresés / felvétel gombbal jelöld be, mi van otthon.'):(language==='en'?'No matches. Try another name.':'Nincs találat. Próbálj más nevet.'))+'</div>';
 const grid=group=>'<div class="ingredient-grid">'+group.map(i=>ingredientCard(i,hasCart)).join('')+'</div>';
 if(search.trim()||category!=='Minden')return grid(items);
 return categoryPriorityOrder.filter(c=>items.some(i=>i.category===c)).map(c=>{
 const group=items.filter(i=>i.category===c),icon=categoryIcon(c);
 return '<details class="catalog-section" data-collapse="'+esc(c)+'" '+(!collapsedCategories.has(c)?'open':'')+'><summary><span class="category-icon" aria-hidden="true">'+icon+'</span><span class="category-title">'+esc(c)+'</span><span class="category-count">'+group.length+'</span><span class="category-chevron" aria-hidden="true">⌄</span></summary>'+grid(group)+'</details>';
 }).join('');
}
function bindCatalog(){
 main.querySelector('[data-empty-add]')?.addEventListener('click',openPantryEntry);
 main.querySelectorAll('[data-collapse]').forEach(d=>d.ontoggle=()=>{if(d.open)collapsedCategories.delete(d.dataset.collapse);else collapsedCategories.add(d.dataset.collapse)});
 main.querySelectorAll('[data-home]').forEach(b=>b.onclick=async()=>{const n=b.dataset.home,previous=state.stock[n]||0;if(previous>0&&window.PantryReview){b.disabled=true;await window.PantryReview.remove([n]);if(b.isConnected)b.disabled=false;return}if(commitState({...state,stock:{...state.stock,[n]:previous>0?0:2}})){for(let i=homeUndo.length-1;i>=0;i--)if(homeUndo[i].name===n)homeUndo.splice(i,1);if(previous>0){homeUndo.length=0;homeUndo.push({name:n,value:previous,expires:Date.now()+8000})}await window.PantryReview?.confirm([n]);refreshCatalog()}});
 main.querySelectorAll('[data-basket]').forEach(b=>bindAddButton(b,b.dataset.basket));
 main.querySelectorAll('[data-card-drag]').forEach(center=>bindIngredientDrag(center));
}
function bindIngredientDrag(center){
 let origin=null,moved=false,dx=0;const card=center.closest('.ingredient-card');
 const reset=()=>{center.style.transform='';card.classList.remove('drag-home','drag-cart');origin=null};
 center.addEventListener('pointerdown',e=>{if(e.button!==0)return;origin={x:e.clientX,y:e.clientY};dx=0;moved=false;center.setPointerCapture(e.pointerId)});
 center.addEventListener('pointermove',e=>{if(!origin)return;dx=e.clientX-origin.x;const dy=e.clientY-origin.y;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){reset();return}moved=Math.abs(dx)>12;center.style.transform='translateX('+Math.max(-36,Math.min(36,dx))+'px)';card.classList.toggle('drag-home',dx>20);card.classList.toggle('drag-cart',dx<-20)});
 center.addEventListener('pointerup',()=>{if(!origin)return;const n=center.dataset.cardDrag,act=moved&&Math.abs(dx)>=28?Math.sign(dx):0;reset();if(act>0){state.stock[n]=2;save();toast(n+' otthonra jelölve.');refreshCatalog()}else if(act<0){if(addCart(n)){toast(n+' a listára került.');refreshCatalog()}}});
 center.addEventListener('pointercancel',reset);center.addEventListener('lostpointercapture',reset);
}
function refreshCatalog(){const scroll=window.scrollY;renderPantry();window.scrollTo(0,scroll)}
let recipePreferences=RecipePrompt.normalizePreferences();try{recipePreferences=RecipePrompt.normalizePreferences(JSON.parse(localStorage.getItem('morzsa-recipe-preferences'))||{})}catch{}
function recipeRequest(){return RecipePrompt.build(state,catalog,productEnglish,language,recipePreferences,window.PantryReview?.uncertain()||[])}
const dashboardMicIcon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
// The shopping list remains the launch screen; overview is an explicit destination.
function dashboardGo(destination){page=destination;if(destination==='pantry'){stockView='home';category='Minden';search=''}render();window.scrollTo({top:0,behavior:'instant'})}
const surpriseSeen=new Map();
function surpriseRecipe(){
 const key=JSON.stringify([window.household?.active||'local',Object.entries(state.stock).filter(([,v])=>v>0).map(([n])=>n).sort()]);
 const seen=surpriseSeen.get(key)||[],eligible=window.KitchenIntelligence?.eligibleRecipes(recipes)||recipes,chosen=SurpriseRecipe.choose(eligible,state.stock,seen);
 if(!chosen){window.MorzsaCompanion?.ask(language==='en'?'Suggest a meal using my pantry and cooking preferences.':'Ajánlj egy ételt a készletemből, a főzési ízlésem alapján.');return}
 surpriseSeen.set(key,[...seen,chosen.id].slice(-recipes.length));if(surpriseSeen.size>8)surpriseSeen.delete(surpriseSeen.keys().next().value);
 openRecipe(chosen.id);
 const next=document.createElement('button');next.className='surprise-again small-button';next.setAttribute('data-no-translate','');next.textContent=language==='en'?'Another idea':'Másik ötlet';next.onclick=surpriseRecipe;
 const label=document.createElement('p');label.className='surprise-caption';label.setAttribute('data-no-translate','');label.textContent=language==='en'?'A little inspiration from our recipe collection.':'Egy kis inspiráció a receptgyűjteményünkből.';
 dialog.querySelector('h2').after(label,next);
}
function dashboardRecipeRow(r){
 if(!r)return '<button class="small-button" data-dashboard-go="recipes">'+(language==='en'?'Find a recipe for our preferences':'Keressünk az ízlésünkhöz illő receptet')+'</button>';
 const say=(hu,en)=>language==='en'?en:hu,available=r.ingredients.length-missing(r).length;
 const image=productArtwork[r.ingredients[0][0]]||'assets/icons/oats.webp';
 return '<article class="idea-row"><button class="idea-open" data-recipe="'+r.id+'"><img class="dashboard-recipe-art" src="'+image+'" width="48" height="48" alt=""><span><strong>'+esc(language==='en'?englishText(r.name):r.name)+'</strong><small>'+r.time+say(' perc · ',' min · ')+available+'/'+r.ingredients.length+say(' hozzávaló otthon',' ingredients at home')+'</small></span></button><button class="idea-save" data-save-recipe="'+r.id+'" aria-pressed="'+state.likes.includes(r.id)+'" aria-label="'+esc(say('Kedvenc: ','Favourite: ')+(language==='en'?englishText(r.name):r.name))+'">'+(state.likes.includes(r.id)?'♥':'♡')+'</button></article>';
}
function renderDashboard(){
 const say=(hu,en)=>language==='en'?en:hu,homeCount=Object.values(state.stock).filter(n=>n>0).length,low=Object.values(state.stock).filter(n=>n>0&&n<=1).length,pending=state.cart.filter(x=>!x.done);
 const recipe=[...(window.KitchenIntelligence?.eligibleRecipes(recipes)||recipes)].sort((a,b)=>score(b)-score(a))[0],last=state.history[0];
 main.innerHTML='<div class="dashboard calm-dashboard" data-no-translate><div class="daily-heading"><div><h1>'+say('Jó itthon.','Good to be home.')+'</h1><p>'+say('A konyhátok, egy pillantással.','Your kitchen at a glance.')+'</p></div><img src="assets/illustrations/morzsa-mascot.webp" width="66" height="60" alt=""></div><div class="daily-counts"><button data-dashboard-go="pantry"><strong>'+homeCount+'</strong><span>'+say('Otthon','At home')+'</span><small>'+say(low?low+' alapanyagból kevés':'Mi van a konyhában?',low?low+' ingredients running low':'What’s in your kitchen?')+'</small></button><button data-dashboard-go="shopping"><strong>'+pending.length+'</strong><span>'+say('Listán','On your list')+'</span><small>'+say(pending.length?'Ennyit kell még beszerezni':'Most nincs hiányzó tétel',pending.length?'Still to pick up':'Nothing to pick up')+'</small></button></div><section class="dashboard-meals"><div class="dashboard-section-title"><h2>'+say('Mit főzzünk ma?','What shall we cook today?')+'</h2><button class="small-button" data-dashboard-go="recipes">'+say('Receptek →','Recipes →')+'</button></div>'+dashboardRecipeRow(recipe)+'<button class="surprise-button" id="surprise-recipe">'+say('Lepj meg','Surprise me')+'</button></section>'+(!homeCount||state.cart.length?'<button class="daily-next" data-dashboard-go="'+(homeCount?'shopping':'pantry')+'"><strong>'+(!homeCount?say('Mi lapul a konyhádban?','What is in your kitchen?'):!pending.length?say('Minden kipipálva · befejezed?','All checked off · finish shopping?'):say('A következő bevásárlás','Your next shopping trip'))+'</strong><span>'+(!homeCount?say('Vegyél fel néhány alapanyagot.','Add a few ingredients.'):pending.length?esc(pending.slice(0,3).map(i=>displayName(i.name)).join(', ')):say('Vásárlás befejezése','Finish shopping'))+' →</span></button>':'')+'<div id="dashboard-review-slot"></div>'+(last?'<details class="daily-history"><summary>'+say('Legutóbbi bevásárlás','Last shopping trip')+'</summary><button id="dashboard-history">'+last.items.length+say(' termék · ',' products · ')+esc(new Date(last.date).toLocaleDateString(language==='en'?'en-GB':'hu-HU'))+' →</button></details>':'')+'</div>';
 main.querySelectorAll('[data-dashboard-go]').forEach(b=>b.onclick=()=>dashboardGo(b.dataset.dashboardGo));
 main.querySelector('#dashboard-history')?.addEventListener('click',openArchive);main.querySelector('#surprise-recipe').onclick=surpriseRecipe;
 main.querySelector('[data-recipe]').onclick=()=>openRecipe(recipe.id);main.querySelector('[data-save-recipe]').onclick=()=>{state.likes=state.likes.includes(recipe.id)?state.likes.filter(id=>id!==recipe.id):[...state.likes,recipe.id];save();render()};window.PantryReview?.mount();window.MorzsaWorkspace?.mount();
}
function renderRecipes(){window.RecipeRoom?.render()}

function vote(like){if(!currentId)return;(like?state.likes:state.skips).push(currentId);save();toast(like?'Elmentve a kedvenceid közé ♡':'Most kihagytuk.');render()}
const chatRequests=new Map();let aiConfigured=false;
async function checkAI(){try{aiConfigured=(await window.household.voiceStatus()).configured===true}catch{aiConfigured=false}const el=dialog.querySelector('.ai-status');if(el){el.setAttribute('data-no-translate','');el.textContent=aiConfigured?(language==='en'?'AI ready':'AI készen áll'):(language==='en'?'AI unavailable':'AI most nem érhető el')}}
function openRecipe(id){
 const r=recipes.find(x=>x.id===id);if(!r)return;const m=missing(r);
 dialog.dataset.recipe=id;
 dialog.innerHTML='<button class="close" aria-label="Bezárás">×</button><div class="eyebrow">'+r.time+' PERC · 2 ADAG</div><h2>'+r.name+'</h2><h3>Hozzávalók</h3><ul>'+r.ingredients.map(([n,q])=>'<li>'+esc(n)+' · '+q+(!state.stock[n]?' <strong>— nincs otthon jelölve</strong>':'')+'</li>').join('')+'</ul><h3>Így készül</h3><ol>'+r.steps.map(s=>'<li>'+s+'</li>').join('')+'</ol><button class="primary full" id="cook">'+(m.length?'Ma ezt főzöm · '+m.length+' tétel a listára':'Ma ezt főzöm ✓')+'</button><section class="chat-section" aria-label="Beszélgetés erről a receptről"><div class="chat-heading"><h3>Beszéljük meg ✳</h3><span class="ai-status">AI csatlakozás…</span></div><p class="chat-hint">Helyettesítés, más adagszám, segítség főzés közben. Ez a beszélgetés ennél a receptnél marad.</p><div class="chat-suggestions">'+['Mivel helyettesíthetem?','Négy főre készíteném','Segíts lépésről lépésre'].map(t=>'<button class="small-button" data-chat-suggestion="'+t+'">'+t+'</button>').join('')+'</div><div class="chat-messages" aria-live="polite"></div><div class="chat-pending" role="status"></div><p class="chat-error" role="alert"></p><button class="small-button" id="chat-retry" hidden>Újrapróbálom</button><form class="chat-form"><textarea rows="2" maxlength="2000" placeholder="Kérdezz erről az ételről…" aria-label="Kérdés a recepthez" required></textarea><button class="primary" aria-label="Kérdés küldése">↑</button></form><p class="chat-hint">A kérdés, a recept és az otthon jelölt élelmiszerek az OpenAI-hoz kerülnek. Az AI válaszát érdemes ellenőrizni.</p></section>';
 dialog.querySelector('.close').onclick=()=>dialog.close();
 dialog.querySelector('#cook').onclick=()=>{m.forEach(([n,q])=>addCart(n,r.name+' · '+q));if(!state.likes.includes(id))state.likes.push(id);save();dialog.close();toast(m.length?'A hozzávalók a listán.':'Jó főzést!');if(m.length)page='shopping';render()};
 dialog.querySelector('.chat-form').onsubmit=e=>{e.preventDefault();const input=e.target.querySelector('textarea'),text=input.value.trim();if(!text||chatRequests.has(id))return;state.chats[id]||=[];state.chats[id].push({role:'user',content:text});input.value='';save();sendChat(id)};
 dialog.querySelectorAll('[data-chat-suggestion]').forEach(b=>b.onclick=()=>{const input=dialog.querySelector('textarea');input.value=language==='en'?englishText(b.dataset.chatSuggestion):b.dataset.chatSuggestion;input.focus()});
 dialog.querySelector('#chat-retry').onclick=()=>sendChat(id);
 const disclosure=dialog.querySelectorAll('.chat-hint');disclosure[disclosure.length-1].setAttribute('data-no-translate','');disclosure[disclosure.length-1].textContent=language==='en'?'Your question, this recipe and pantry context are sent to Google AI. This chat does not change your pantry or list.':'A kérdés, a recept és a készlet a Google AI-hoz kerül. Ez a beszélgetés nem módosítja a készletet vagy a listát.';
 paintChat(id);checkAI();if(!dialog.open)dialog.showModal();
}
function paintChat(id){if(dialog.dataset.recipe!==id)return;const history=state.chats[id]||[];
 dialog.querySelector('.chat-messages').innerHTML=history.map(m=>'<div class="chat-message '+m.role+'"><span class="speaker">'+(m.role==='user'?'Te':'Morzsa AI')+'</span><span data-no-translate>'+esc(m.content)+'</span></div>').join('');
 const busy=chatRequests.has(id);dialog.querySelector('.chat-form button').disabled=busy;dialog.querySelector('.chat-pending').textContent=busy?'Morzsa gondolkodik…':'';
 dialog.querySelector('#chat-retry').hidden=busy||!history.length||history[history.length-1].role!=='user';
}
async function sendChat(id){
 if(chatRequests.has(id))return;const context=JSON.stringify([window.household?.userId(),window.household?.active]);chatRequests.set(id,true);if(dialog.dataset.recipe===id)dialog.querySelector('.chat-error').textContent='';paintChat(id);
 try{const recipe=recipes.find(r=>r.id===id),request=RecipeChat.request(state,recipe,language,productCategory,nonFoodCategories,window.PantryReview?.uncertain()||[]);const data=await window.household.voiceCommand(request);
  if(context!==JSON.stringify([window.household?.userId(),window.household?.active]))throw Error('VOICE_CHANGED');
  const reply=data.answer||data.clarification;if(typeof reply!=='string'||!reply.trim())throw Error('VOICE_INVALID_RESPONSE');state.chats[id].push({role:'assistant',content:reply});save();
 }catch(error){if(dialog.dataset.recipe===id){const el=dialog.querySelector('.chat-error');el.setAttribute('data-no-translate','');el.textContent=voiceError(error)}}finally{chatRequests.delete(id);paintChat(id)}
}

function shoppingGroupHeader(category){
 const items=state.cart.filter(item=>productCategory(item.name)===category),pending=items.filter(item=>!item.done).length,complete=pending===0;
 const label=language==='en'?'Everything in this category is checked':'Ebben a kategóriában minden megvan';
 return '<details class="shopping-group '+(complete?'complete':'')+'" data-category="'+esc(category)+'" data-pending="'+pending+'" '+(complete?'':'open')+'><summary><span aria-hidden="true">'+categoryIcon(category)+'</span><span>'+esc(category)+'</span>'+(complete?'<span class="shopping-complete" role="img" data-no-translate aria-label="'+label+'" title="'+label+'"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg></span>':'<small>'+pending+'</small>')+'</summary>';
}
function saveShoppingState(next){return window.household?.active?window.household.editCart(next):commitState(next)}
function refreshShoppingRows(){
 if(page!=='shopping')return;if(window.ShoppingMode?.visible()){renderShopping();return}
 const rows=[...main.querySelectorAll('.list-row')],same=rows.length===state.cart.length&&rows.every(row=>row.dataset.item===state.cart[Number(row.querySelector('[data-cart]').dataset.cart)]?.name);
 if(!same){
  const y=scrollY,input=main.querySelector('#add-cart input'),focused=document.activeElement===input,selection=input?.selectionStart,open=new Map([...main.querySelectorAll('.shopping-group')].map(g=>[g.dataset.category,g.open]));
  renderShopping();for(const g of main.querySelectorAll('.shopping-group'))if(open.has(g.dataset.category)&&!g.classList.contains('complete'))g.open=open.get(g.dataset.category);
  if(focused){const next=main.querySelector('#add-cart input');next?.focus({preventScroll:true});next?.setSelectionRange(selection,selection)}window.scrollTo(0,y);return;
 }
 for(const row of rows){const checkbox=row.querySelector('[data-cart]'),item=state.cart[Number(checkbox.dataset.cart)];checkbox.checked=!!item.done;row.classList.toggle('done',!!item.done);const amount=row.querySelector('.quantity-badge'),text=cartAmount(item);if(amount.textContent!==text)amount.textContent=text;const decrement=row.querySelector('[data-step="-1"]');if(decrement)decrement.disabled=(item.quantity||1)<=1;const copy=row.querySelector('.list-item-copy'),markup=window.RecipeRoom?.sourceMarkup(item)||'';if(copy){const old=copy.querySelector('.recipe-source-links');if((old?.outerHTML||'')!==markup){old?.remove();copy.insertAdjacentHTML('beforeend',markup)}}}
 for(const group of main.querySelectorAll('.shopping-group')){const remaining=state.cart.filter(i=>productCategory(i.name)===group.dataset.category&&!i.done).length;if(group.dataset.pending===String(remaining))continue;group.dataset.pending=remaining;const template=document.createElement('template');template.innerHTML=shoppingGroupHeader(group.dataset.category)+'</details>';const next=template.content.firstElementChild,wasComplete=group.classList.contains('complete'),complete=next.classList.contains('complete');group.classList.toggle('complete',complete);group.querySelector('summary').replaceWith(next.querySelector('summary'));if(complete&&!wasComplete)group.open=false;else if(!complete&&wasComplete)group.open=true}
 const finish=main.querySelector('#restock');if(finish)finish.disabled=!!window.household?.cartPending;
 const pending=state.cart.filter(x=>!x.done).length;main.querySelector('#shopping-pending').textContent=pending+(language==='en'?' items':' tétel');updateCount();
}
function renderShopping(){
 if(window.ShoppingMode?.render())return;
 const pending=state.cart.filter(x=>!x.done).length,order=categoryPriorityOrder;
 const groups=[...new Set(state.cart.map(x=>productCategory(x.name)))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
 main.innerHTML='<div class="pantry-heading"><h1>Bevásárlólista</h1><span id="shopping-pending" data-no-translate>'+pending+(language==='en'?' items':' tétel')+'</span></div>'+(state.cart.length?groups.map(c=>shoppingGroupHeader(c)+state.cart.map((x,i)=>({x,i})).filter(({x})=>productCategory(x.name)===c).sort((a,b)=>compareProducts(a.x,b.x)).map(({x,i})=>'<div data-item="'+esc(x.name)+'" class="list-row '+(x.done?'done':'')+'"><input type="checkbox" id="cart-'+i+'" data-cart="'+i+'" '+(x.done?'checked':'')+'><div class="list-item-copy"><label for="cart-'+i+'" '+(!productEnglish[x.name]?'data-no-translate':'')+'>'+esc(x.name)+'</label>'+(window.RecipeRoom?.sourceMarkup(x)||'')+'</div><button class="quantity-badge" data-edit-quantity="'+i+'" aria-label="'+esc(x.name)+': '+(language==='en'?'edit details and quantity':'részletek és mennyiség')+'">'+esc(cartAmount(x))+'</button></div>').join('')+'</details>').join(''):'<div class="empty"><span>🧺</span>Most üres a kosarad.<br>Írd be lent, mire van szükséged.</div>')+'<form class="add-form" id="add-cart"><input aria-label="Új bevásárlótétel" placeholder="Még valami a listára…" maxlength="60" required><button aria-label="Listára vétel">+</button></form>'+(state.cart.length?'<button class="primary full" id="restock">Vásárlás befejezése</button><p class="helper" data-no-translate>'+(language==='en'?'Purchased items go to your pantry and archive.':'A megvett tételek a készletbe és az archívumba kerülnek.')+'</p>':'');
 main.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.index),item=state.cart[i],quantity=Math.max(1,(item.quantity||1)+Number(b.dataset.step));if(saveShoppingState({...state,cart:state.cart.map((x,j)=>j===i?{...x,quantity}:x)}))refreshShoppingRows()});
 main.querySelectorAll('[data-cart]').forEach(i=>i.onchange=()=>{const index=Number(i.dataset.cart),next=ShoppingModeModel.check(state,state.cart[index].name,i.checked,household?.userId()||null,new Date().toISOString());if(saveShoppingState(next))refreshShoppingRows();else i.checked=!i.checked});
 main.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{const index=Number(b.dataset.delete);if(saveShoppingState({...state,cart:state.cart.filter((_,i)=>i!==index)}))refreshShoppingRows()});
 main.querySelectorAll('[data-edit-quantity]').forEach(b=>b.onclick=()=>openQuantity(state.cart[Number(b.dataset.editQuantity)].name,true));

 const restock=main.querySelector('#restock');if(restock){restock.disabled=!!window.household?.cartPending;restock.onclick=()=>finishShopping()}
 const actions=document.createElement('div');actions.className='shopping-actions';actions.innerHTML='<details class="shopping-menu"><summary aria-label="'+(language==='en'?'List options':'Lista műveletek')+'">···</summary><div><button class="small-button" data-secondary-stock>'+ (language==='en'?'Add to pantry':'Felvétel a készletbe')+'</button><button class="small-button" id="open-history">Korábbi vásárlások · '+state.history.length+'</button>'+(state.cart.length?'<button class="small-button" id="clear-cart">Lista törlése</button>':'')+'</div></details>';main.querySelector('.pantry-heading').append(actions);actions.querySelector('#open-history').onclick=openArchive;const clear=actions.querySelector('#clear-cart');if(clear)clear.onclick=confirmClearCart;
 actions.querySelector('[data-secondary-stock]').onclick=()=>window.MorzsaWorkspace.quick('stock');
 setupQuickEntry(actions);window.ShoppingMode?.normal();
}
function swipe(el,callback){let x=0,y=0,active=false;el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;if(e.target.closest('button')&&e.target.closest('button')!==el)return;x=e.clientX;y=e.clientY;active=true;el.setPointerCapture(e.pointerId)});el.addEventListener('pointermove',e=>{if(!active)return;const dx=e.clientX-x,dy=e.clientY-y;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>15){active=false;el.style.transform='';return}if(Math.abs(dx)>15)el.style.transform='translateX('+Math.max(-90,Math.min(90,dx))+'px) rotate('+(dx/30)+'deg)'});const end=e=>{if(!active)return;active=false;el.style.transform='';const dx=e.clientX-x;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(e.clientY-y)){callback(dx>0?1:-1)}};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',()=>{active=false;el.style.transform=''})}
main.addEventListener('click',e=>{if(e.target.closest('#saved-toggle')){showSaved=!showSaved;render()}}); document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{if(b.dataset.page==='chat'&&window.MorzsaCompanion){window.MorzsaCompanion.open();return}page=b.dataset.page;render();window.scrollTo({top:0,behavior:'instant'})});document.querySelector('.brand').onclick=e=>{e.preventDefault();if(window.MorzsaCompanion){window.MorzsaCompanion.open();return}page='chat';render();window.scrollTo(0,0)};dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});render();

function commitState(next){
 try{localStorage.setItem(window.household?.storageKey()||'morzsa-v2',JSON.stringify(next))}catch{toast('Nem sikerült menteni. Semmit sem módosítottunk.');return false}
 state=next;updateCount();window.PantryReview?.onStateChanged();window.household?.notify();return true;
}
let purchaseSaving=false;
function finishShopping(){
 if(!state.cart.length||purchaseSaving||window.household?.busy)return;
 if(window.ShoppingMode?.active()||state.cart.some(item=>!item.done&&productCategory(item.name)!=='Saját tételek'))showFinishPrompt();else if(state.cart.some(item=>item.done))completeShopping(false);else toast(language==='en'?'Check what you bought. Your custom reminders stay on the list.':'Pipáld ki, amit megvettél. A saját emlékeztetők a listán maradnak.');
}
function showFinishPrompt(error=''){
 const say=(hu,en)=>language==='en'?en:hu,unchecked=state.cart.filter(item=>!item.done&&productCategory(item.name)!=='Saját tételek').length,optional=state.cart.filter(item=>!item.done&&productCategory(item.name)==='Saját tételek').length,checked=state.cart.filter(item=>item.done).length;
 let q=document.getElementById('finish-shopping-dialog');if(!q){q=document.createElement('dialog');q.id='finish-shopping-dialog';q.setAttribute('data-no-translate','');q.setAttribute('aria-labelledby','finish-title');document.body.append(q)}
 const sessionSummary=window.ShoppingMode?.active()?window.ShoppingMode.summary():null;
 q.innerHTML='<h2 id="finish-title">'+say('Befejezed a vásárlást?','Finish shopping?')+'</h2>'+(sessionSummary?'<p class="shopping-finish-summary">'+sessionSummary.bought+say(' megvásárolva · ',' purchased · ')+sessionSummary.remaining+say(' hátravan · ',' remaining · ')+sessionSummary.added+say(' most hozzáadva · ',' added now · ')+sessionSummary.removed+say(' levéve',' removed')+'</p>':'')+'<p>'+(unchecked?unchecked+say(' tétel még nincs kipipálva. Ezeket is megvetted?',' items are still unchecked. Did you buy these too?'):say('A kipipált tételeket mentjük vásárlásként.','Checked items will be saved as purchases.'))+(optional?say(' A be nem pipált saját tételek a listán maradnak.',' Unchecked custom items stay on your list.'):'')+'</p><p class="helper">'+say('Csak a megvett tételek kerülnek a készletbe és az archívumba. A többi a listán marad.','Only purchased items go to your pantry and archive. The rest stay on your list.')+'</p><p class="finish-error" role="alert">'+esc(error)+'</p><div class="finish-options"><button class="primary" id="finish-all" '+(!unchecked&&!checked?'disabled':'')+'>'+say('Az összes normál tételt megvettem','I bought all regular items')+'</button><button class="small-button" id="finish-checked" '+(!checked&&!sessionSummary?'disabled':'')+'>'+say('Csak a kipipáltakat · '+checked,'Only checked items · '+checked)+'</button><button class="small-button" id="finish-cancel" autofocus>'+say('Még vásárolok','Keep shopping')+'</button></div>';
 q.querySelector('#finish-cancel').onclick=()=>{if(!purchaseSaving)q.close()};q.oncancel=e=>{if(purchaseSaving)e.preventDefault()};
 for(const [id,include] of [['finish-all',true],['finish-checked',false]])q.querySelector('#'+id).onclick=async()=>{q.querySelectorAll('button').forEach(b=>b.disabled=true);if(await completeShopping(include))q.close();else showFinishPrompt(say('Nem sikerült lezárni a vásárlást. Ellenőrizd a friss listát, és próbáld újra.','Could not finish shopping. Check the updated list and try again.'))};
 if(!q.open)q.showModal();
}
async function completeShopping(includeUnchecked){
 if(window.ShoppingMode?.active())return window.ShoppingMode.finish(includeUnchecked);
 if(purchaseSaving||window.household?.busy)return false;
 const purchaseBefore=JSON.parse(JSON.stringify(state)),purchaseContext=typeof voiceContext==='function'?voiceContext():null;
 const next=ShoppingModel.complete(state,{includeUnchecked,id:crypto.randomUUID(),date:new Date().toISOString(),unitFor:productUnit,categoryFor:productCategory,knownNames:catalog.map(item=>item.name)});
 if(!next)return false;
 purchaseSaving=true;
 try{
  let saved;if(window.household?.active){state=next;saved=await window.household.notify()}else saved=commitState(next);
  if(!saved)return false;
  if(purchaseContext!==voiceContext())return true;
  await window.PantryReview?.confirm(next.history[0].items.map(i=>i.name));
  if(purchaseContext!==voiceContext())return true;
  window.MorzsaCompanion?.purchaseSaved(purchaseBefore,next,purchaseContext);
  toast(language==='en'?'Shopping saved. Purchased items are now in your pantry.':'Vásárlás elmentve. A megvett tételek a készletbe kerültek.');render();return true;
 }finally{purchaseSaving=false}
}
function confirmClearCart(){
 if(!state.cart.length)return;
 const q=document.getElementById('clear-dialog');
 q.innerHTML='<h2 id="clear-title">Törlöd a teljes listát?</h2><p>'+state.cart.length+' tétel kerül le a listáról. Nem mentjük az archívumba, és nem adjuk az otthoni készlethez. A törlés nem vonható vissza.</p><p class="clear-error" role="alert"></p><div class="clear-actions"><button class="small-button" id="cancel-clear" autofocus>Mégse</button><button class="primary" id="confirm-clear">Lista törlése</button></div>';
 q.querySelector('#cancel-clear').onclick=()=>q.close();
 q.querySelector('#confirm-clear').onclick=()=>{if(commitState({...state,cart:[]})){q.close();renderShopping();toast('A bevásárlólistát töröltük.')}else q.querySelector('.clear-error').textContent='Nem sikerült menteni. A listád megmaradt.'};
 q.showModal();
}
function restoreArchive(id){
 const entry=state.history.find(x=>x.id===id);if(!entry)return false;
 const next=JSON.parse(JSON.stringify(state));
 for(const item of entry.items){
  const existing=next.cart.find(x=>x.name.toLocaleLowerCase('hu')===item.name.toLocaleLowerCase('hu'));
  if(existing&&!existing.done&&(existing.unit||productUnit(existing.name))!==item.unit){toast(item.name+': eltérő egység. Előbb módosítsd a listán.');return false}
  if(existing){existing.quantity=(existing.done?0:existing.quantity||1)+item.quantity;existing.unit=item.unit;existing.done=false}
  else next.cart.push({name:item.name,source:'Archívum',quantity:item.quantity,unit:item.unit,done:false,...(Array.isArray(item.recipeNeeds)?{recipeNeeds:item.recipeNeeds.map(n=>({...n,recipe:n.recipe||entry.recipeSnapshots?.[n.recipeIndex]})).filter(n=>n.recipe)}:{})});
 }
 for(const item of next.cart)if(![...catalog,...next.custom].some(x=>x.name.toLocaleLowerCase('hu')===item.name.toLocaleLowerCase('hu')))next.custom.push({name:item.name,emoji:'🫙',category:'Saját tételek'});
 if(!commitState(next))return false;
 render();toast('Hozzáadva; a meglévő mennyiségeket összeadtuk.');return true;
}
function openArchive(){
 const q=document.getElementById('history-dialog');
 q.innerHTML='<button class="close" aria-label="Archívum bezárása">×</button><h2>Korábbi vásárlások</h2><p class="helper">Ezen a böngészőn mentve. Újra hozzáadáskor a mennyiségek összeadódnak.</p><p id="archive-feedback" role="status"></p>'+(!state.history.length?'<div class="empty">Még nincs mentett listád.</div>':state.history.map(entry=>{
 const categories=[...new Set(entry.items.map(x=>x.category||productCategory(x.name)))];
 return '<details class="archive-entry"><summary><span><strong>'+(entry.kind==='purchase'?'Vásárlás':'Ürítés előtt mentve')+'</strong><small>'+esc(new Date(entry.date).toLocaleString(language==='en'?'en-GB':'hu-HU',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))+' · '+entry.items.length+' tétel</small></span></summary>'+categories.map(c=>'<h3>'+esc(c)+'</h3>'+entry.items.filter(x=>(x.category||productCategory(x.name))===c).map(x=>'<div class="archive-row"><span>'+esc(x.name)+(entry.kind==='cleared'&&x.done?' ✓':'')+'</span><span>'+esc(cartAmount(x))+'</span></div>').join('')).join('')+'<button class="small-button full" data-restore="'+esc(entry.id)+'">Vásárlás újrafelhasználása</button></details>';
 }).join(''));
 q.querySelector('.close').onclick=()=>q.close();q.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{if(restoreArchive(b.dataset.restore)){b.disabled=true;b.textContent='Hozzáadva ✓';q.querySelector('#archive-feedback').textContent='Hozzáadva a bevásárlólistához.'}else q.querySelector('#archive-feedback').textContent=document.getElementById('toast').textContent});q.showModal();
}

function confirmClearStock(){
 const q=document.getElementById('clear-dialog');
 q.innerHTML='<h2 id="clear-title">Kiüríted a készletet?</h2><p>Minden otthonjelölést eltávolítunk. A bevásárlólista és a saját termékeid megmaradnak.</p>'+(window.household?.active?'<p>A közös háztartás minden tagjának készlete kiürül.</p>':'')+'<div class="clear-actions"><button class="small-button" id="cancel-clear" autofocus>Mégse</button><button class="primary" id="confirm-clear">Készlet ürítése</button></div>';
 q.querySelector('#cancel-clear').onclick=()=>q.close();q.querySelector('#confirm-clear').onclick=()=>{if(commitState({...state,stock:{}})){homeUndo.length=0;q.close();refreshCatalog();toast(language==='en'?'Pantry cleared.':'A készletet kiürítettük.')}};q.showModal();
}
function setupQuickEntry(actions){
 const form=main.querySelector('#add-cart');main.querySelector('.pantry-heading').after(form);form.classList.add('quick-entry');
 form.innerHTML='<div class="quick-input"><input role="combobox" aria-label="Új bevásárlótétel" aria-autocomplete="list" aria-controls="quick-options" aria-expanded="false" placeholder="Tej, kenyér, alma…" autocomplete="off" enterkeyhint="done"><button aria-label="Listára vétel">+</button></div><div id="quick-options" role="listbox" hidden></div>';
 const input=form.querySelector('input'),options=form.querySelector('#quick-options');input.value=shoppingDraft;let choices=[],active=-1;
 const close=()=>{options.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1};
 const suggest=()=>{shoppingDraft=input.value;active=-1;choices=QuickEntry.ranked(input.value,[...catalog,...state.custom],productEnglish).slice(0,5);options.innerHTML=choices.map((x,i)=>'<button type="button" role="option" aria-selected="false" id="quick-option-'+i+'" data-option="'+i+'" data-no-translate><span>'+esc(displayName(x.item.name))+'</span><small>'+esc(language==='en'?englishText(x.item.category):x.item.category)+'</small></button>').join('');options.hidden=!choices.length;input.setAttribute('aria-expanded',String(!!choices.length));input.removeAttribute('aria-activedescendant');options.querySelectorAll('button').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>commit([choices[Number(b.dataset.option)].item.name],'')})};
 const commit=async(parts,remainder)=>{
  if(window.household?.active&&!window.household.cartInteractive)return;
  const names=parts.map(x=>x.trim()).filter(Boolean);if(!names.length){input.value=remainder;shoppingDraft=remainder;suggest();return}
  const next=ShoppingModeModel.add(state,names,{sessionId:null,actor:household?.userId()||null,now:new Date().toISOString(),resolve:n=>QuickEntry.match(n,[...catalog,...state.custom],productEnglish),unitFor:productUnit,known:catalog});
  const original=input.value;shoppingDraft=remainder;
  if(!saveShoppingState(next))shoppingDraft=original;
  basketFeedback();if(page==='shopping'){renderShopping();const field=main.querySelector('#add-cart input');field.focus({preventScroll:true});field.setSelectionRange(field.value.length,field.value.length)}
 };
 input.oninput=e=>{if(e.isComposing){shoppingDraft=input.value;return}const parts=input.value.split(/[,;\n]/);if(parts.length>1)commit(parts.slice(0,-1),parts.at(-1));else suggest()};
 input.onpaste=e=>{const text=e.clipboardData?.getData('text');if(text&&/[,;\n]/.test(text)){e.preventDefault();input.value=input.value.slice(0,input.selectionStart)+text+input.value.slice(input.selectionEnd);input.dispatchEvent(new Event('input'))}};
 input.oncompositionend=()=>input.dispatchEvent(new Event('input'));
 input.onfocus=suggest;input.onblur=()=>setTimeout(()=>{if(!form.contains(document.activeElement))close()},100);
 input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Escape'){close();return}if(['ArrowDown','ArrowUp'].includes(e.key)&&choices.length){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;options.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant','quick-option-'+active)}if(e.key==='Enter'){e.preventDefault();commit([active>=0?choices[active].item.name:input.value],'')}};
 form.onsubmit=e=>{e.preventDefault();commit(input.value.split(/[,;\n]/),'')};
}

function setupPantryNavigation(){
 const heading=main.querySelector('.pantry-heading'),row=main.querySelector('.catalog-search-row'),sort=row.querySelector('#sort-toggle'),tools=heading.querySelector('.pantry-tools');
 heading.querySelector('span').remove();tools.append(sort);row.remove();main.querySelector('#add-item')?.remove();
 sort.setAttribute('data-no-translate','');sort.textContent=sortMode==='alpha'?(language==='en'?'Sort by relevance':'Relevancia szerinti rendezés'):(language==='en'?'Sort alphabetically':'ABC szerinti rendezés');sort.setAttribute('aria-label',sort.textContent);sort.removeAttribute('aria-pressed');
 const chatgpt=document.createElement('button');chatgpt.id='chatgpt-pantry';chatgpt.className='small-button';chatgpt.setAttribute('data-no-translate','');chatgpt.textContent=language==='en'?'Recipes':'Receptek';chatgpt.onclick=()=>dashboardGo('recipes');tools.append(chatgpt);
 const fab=document.createElement('button');fab.className='pantry-search-fab';fab.setAttribute('data-no-translate','');fab.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span>'+(language==='en'?'Search / add':'Keresés / felvétel')+'</span>';fab.onclick=openPantryEntry;main.append(fab);
 fab.style.bottom=(document.querySelector('nav').getBoundingClientRect().height+12)+'px';
 const voice=document.createElement('button');voice.className='pantry-voice-fab';voice.setAttribute('data-no-translate','');voice.setAttribute('aria-label',language==='en'?'Manage pantry by voice':'Készlet kezelése hanggal');voice.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';voice.onclick=()=>openVoiceCommand();voice.style.bottom=fab.style.bottom;main.append(voice);
 if(stockView==='home'){setupHomeOverview();return}
 const rail=main.querySelector('.category-rail'),buttons=[...rail.children],pages=[];
 const dock=document.createElement('div');dock.className='category-dock';rail.before(dock);
 const fixed=document.createElement('div');fixed.className='category-fixed';fixed.append(...buttons.splice(0,2));dock.append(fixed,rail);
 for(let start=0;start<buttons.length;start+=16){const panel=document.createElement('div');panel.className='category-page';buttons.slice(start,start+16).forEach(b=>panel.append(b));pages.push(panel)}
 rail.replaceChildren(...pages);rail.setAttribute('aria-label',language==='en'?'Category pages':'Kategóriaoldalak');
 const pager=document.createElement('div');pager.className='category-pager';pager.innerHTML='<button data-prev aria-label="'+(language==='en'?'Previous categories':'Előző kategóriák')+'">‹</button>'+pages.map((_,i)=>'<button aria-label="'+(language==='en'?'Category page ':'Kategóriaoldal ')+(i+1)+'" data-category-page="'+i+'"><span></span></button>').join('')+'<button data-next aria-label="'+(language==='en'?'Next categories':'Következő kategóriák')+'">›</button>';dock.after(pager);
 const pageWidth=()=>pages[0].getBoundingClientRect().width;
 const update=()=>{pager.querySelectorAll('[data-category-page]').forEach((b,i)=>b.setAttribute('aria-current',i===categoryPage?'true':'false'));pager.querySelector('[data-prev]').disabled=rail.scrollLeft<2;pager.querySelector('[data-next]').disabled=rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2};
 const move=left=>rail.scrollTo({left,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 const go=i=>{categoryPage=Math.max(0,Math.min(pages.length-1,i));move(categoryPage*pageWidth());update()};
 pager.querySelectorAll('[data-category-page]').forEach((b,i)=>b.onclick=()=>go(i));
 pager.querySelector('[data-prev]').onclick=()=>move(Math.max(0,rail.scrollLeft-rail.clientWidth));pager.querySelector('[data-next]').onclick=()=>move(rail.scrollLeft+rail.clientWidth);
 rail.onscroll=()=>{categoryOffset=rail.scrollLeft;categoryPage=Math.min(pages.length-1,Math.floor((rail.scrollLeft+rail.clientWidth/2)/pageWidth()));update()};
 rail.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(categoryPage+(e.key==='ArrowRight'?1:-1));pages[categoryPage].querySelector('button').focus({preventScroll:true})}};
 // Native touch scrolling plus mouse dragging, without turning a drag into a selection.
 let drag=null,suppressClick=false;
 rail.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,left:rail.scrollLeft};suppressClick=false});
 rail.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>5){suppressClick=true;rail.setPointerCapture(e.pointerId);rail.scrollLeft=drag.left-dx}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])rail.addEventListener(event,()=>{drag=null});
 rail.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false}},true);
 categoryPage=Math.min(categoryPage,pages.length-1);rail.scrollLeft=categoryOffset;update();
}

function showHomeUndo(){
 clearInterval(homeUndoTimer);document.querySelector('.undo-home')?.remove();
 const last=homeUndo.at(-1);if(!last)return;
 if(!last.expires||last.expires<=Date.now()){homeUndo.length=0;return}
 const notice=document.createElement('div');notice.className='undo-home';notice.setAttribute('role','status');notice.setAttribute('data-no-translate','');
 notice.innerHTML='<span class="undo-name">'+esc(displayName(last.name))+'</span><span class="undo-count" aria-hidden="true"></span><button data-undo>'+(language==='en'?'Undo':'Visszavonás')+'</button><button data-dismiss aria-label="'+(language==='en'?'Dismiss':'Bezárás')+'">×</button><i class="undo-progress" aria-hidden="true"></i>';
 const dismiss=()=>{clearInterval(homeUndoTimer);homeUndo.length=0;notice.remove()};
 notice.querySelector('[data-dismiss]').onclick=dismiss;
 notice.querySelector('[data-undo]').onclick=()=>{if(window.household?.busy)return;if(commitState({...state,stock:{...state.stock,[last.name]:last.value}})){dismiss();render()}};
 let previous=Date.now();
 const tick=()=>{const now=Date.now();if(notice.matches(':hover')||notice.contains(document.activeElement)||window.household?.busy)last.expires+=now-previous;previous=now;const remaining=last.expires-now;if(remaining<=0){dismiss();return}const counter=notice.querySelector('.undo-count'),seconds=String(Math.ceil(remaining/1000));if(counter.textContent!==seconds)counter.textContent=seconds;notice.style.setProperty('--undo-progress',Math.min(1,remaining/8000));const nav=document.querySelector('nav');notice.style.bottom=(innerHeight-nav.getBoundingClientRect().top+10)+'px'};
 document.body.append(notice);tick();homeUndoTimer=setInterval(tick,100);
}

main.addEventListener('click',e=>{const button=e.target.closest('[data-ai-client], [data-chatgpt-ideas]');if(button)openChatGPTIdeas(button.dataset.aiClient||'ChatGPT')});
function openChatGPTIdeas(initialClient='ChatGPT'){
 const clients={ChatGPT:'https://chatgpt.com/',Gemini:'https://gemini.google.com/app',Claude:'https://claude.ai/new'};
 const say=(hu,en)=>language==='en'?en:hu,{text,count}=RecipePrompt.build(state,catalog,productEnglish,language,recipePreferences,window.PantryReview?.uncertain()||[]);
 let q=document.getElementById('chatgpt-dialog');if(!q){q=document.createElement('dialog');q.id='chatgpt-dialog';q.setAttribute('data-no-translate','');document.body.append(q)}
 q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><h2>'+say('Főzzünk a készletből','Cook from your pantry')+'</h2>'+(count?'<label for="recipe-ai-client">'+say('Melyik AI-val?','Which AI?')+'</label><select id="recipe-ai-client">'+Object.keys(clients).map(c=>'<option>'+c+'</option>').join('')+'</select><p id="ai-client-help"></p><label for="recipe-prompt">'+say('Szerkeszthető kérés','Editable request')+'</label><textarea id="recipe-prompt" rows="7"></textarea><a class="primary full chatgpt-direct" id="open-chatgpt-prompt" target="_blank" rel="noopener noreferrer">'+say('Receptötletek kérése ↗','Ask for recipe ideas ↗')+'</a><button class="small-button full" id="copy-open-chatgpt"></button><p class="chatgpt-feedback" role="status"></p><a id="open-ai-separately" target="_blank" rel="noopener noreferrer"></a><p class="helper">'+say('A saját AI-fiókodban folytatod. A telefonod dönti el, hogy böngészőben vagy appban nyílik meg.','Continue in your own AI account. Your phone determines whether it opens in the browser or app.')+'</p>':'<p>'+say('Előbb jelöld be a készletben, milyen hozzávalók vannak otthon.','First mark the ingredients you have at home in your pantry.')+'</p>');
 q.querySelector('.close').onclick=()=>q.close();
 if(count){
  const input=q.querySelector('textarea'),select=q.querySelector('select'),direct=q.querySelector('#open-chatgpt-prompt'),copy=q.querySelector('#copy-open-chatgpt'),separate=q.querySelector('#open-ai-separately'),message=q.querySelector('.chatgpt-feedback');
  input.value=text;select.value=Object.hasOwn(clients,initialClient)?initialClient:'ChatGPT';
  const update=()=>{const client=select.value;direct.hidden=client!=='ChatGPT';direct.href='https://chatgpt.com/?q='+encodeURIComponent(input.value);copy.textContent=say('Másolás és '+client+' megnyitása ↗','Copy and open '+client+' ↗');copy.className=(client==='ChatGPT'?'small-button':'primary')+' full';separate.href=clients[client];separate.textContent=say(client+' megnyitása külön','Open '+client+' separately');q.querySelector('#ai-client-help').textContent=client==='ChatGPT'?say('Megnyitáskor a kérés automatikusan elindulhat. Ha nem, használd a másolást.','Opening may submit the request automatically. If it does not, use the copy option.'):say('Kimásoljuk a kérést, majd megnyitjuk a '+client+' felületét. Ott illeszd be és küldd el.','We copy the request and open '+client+'. Paste it there and send.');};
  select.onchange=()=>{message.textContent='';update()};input.oninput=update;update();
  copy.onclick=async e=>{
   const button=e.currentTarget,client=select.value,prompt=input.value;button.disabled=true;select.disabled=true;let popup=null;
   try{if(!window.MorzsaNative){popup=window.open('about:blank','_blank');if(popup)popup.opener=null}}catch{}
   try{if(window.MorzsaNative)await window.MorzsaNative.copyText(prompt);else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(prompt);else{input.focus();input.select();if(!document.execCommand('copy'))throw Error('copy')}
    message.textContent=say('Kimásolva. Illeszd be a '+client+' felületén, majd küldd el.','Copied. Paste into '+client+', then send.');
    if(window.MorzsaNative)await window.MorzsaNative.openExternal(clients[client]);else if(popup)popup.location.replace(clients[client]);else message.textContent+=say(' A megnyitáshoz használd az alábbi linket.',' Use the link below to open it.');
   }catch{popup?.close();input.focus();input.select();message.textContent=say('Az automatikus másolás nem sikerült. Másold ki a kijelölt szöveget, majd használd az alábbi linket.','Automatic copying failed. Copy the selected text, then use the link below.')}
   finally{button.disabled=false;select.disabled=false}
  };
 }q.showModal();
}

function openPantryEntry(){
 const say=(hu,en)=>language==='en'?en:hu;
 let q=document.getElementById('pantry-entry-dialog');if(!q){q=document.createElement('dialog');q.id='pantry-entry-dialog';q.setAttribute('data-no-translate','');q.setAttribute('aria-label',say('Keresés és gyűjtés','Search and collect'));document.body.append(q)}
 const basketIcon='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h3l3 13h11M6 6h15l-2 7H7.3"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>';
 q.innerHTML='<form id="pantry-entry-form"><div class="quick-input"><input aria-label="'+say('Keresés és gyűjtés','Search and collect')+'" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="pantry-options" placeholder="'+say('Tej, kenyér, alma…','Milk, bread, apples…')+'" autocomplete="off" enterkeyhint="done"><button type="button" class="close" aria-label="'+say('Bezárás','Close')+'">×</button></div></form><p class="helper">'+say('Vessző vagy Enter: gyűjtés. Utána válassz: készlet vagy lista.','Comma or Enter: collect. Then choose pantry or shopping list.')+'</p><div id="pantry-batch"></div><div class="batch-actions"><button class="primary" id="batch-home"><span aria-hidden="true">+</span> '+say('Készlet','Pantry')+'</button><button class="small-button" id="batch-list">'+basketIcon+' '+say('Lista','Shopping list')+'</button><button class="small-button" id="batch-clear">'+say('Új gyűjtés','Start over')+'</button></div><p class="pantry-entry-feedback" role="status"></p><div id="pantry-options" role="listbox"></div>';
 const input=q.querySelector('input'),options=q.querySelector('#pantry-options'),form=q.querySelector('form'),feedback=q.querySelector('.pantry-entry-feedback');input.value=pantryDraft;let choices=[],active=-1,saving=false;
 const paintBatch=()=>{q.querySelector('#pantry-batch').innerHTML=pantryBatch.map((name,i)=>'<div class="batch-chip"><span>'+esc(displayName(name))+(pantryListed.has(QuickEntry.norm(name))?'<small>'+say('Listára átadva','Added to list')+'</small>':'')+'</span><button type="button" data-remove="'+i+'" aria-label="'+esc(displayName(name))+': '+say('kivétel a gyűjtésből','remove from collection')+'">×</button></div>').join('');q.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(saving)return;pantryBatch.splice(Number(b.dataset.remove),1);paintBatch()});q.querySelector('#batch-home').disabled=saving||(!pantryBatch.length&&!input.value.trim());q.querySelector('#batch-list').disabled=saving||(!input.value.trim()&&!pantryBatch.some(n=>!pantryListed.has(QuickEntry.norm(n))));q.querySelector('#batch-clear').disabled=saving||(!pantryBatch.length&&!input.value);};
 const paint=()=>{pantryDraft=input.value;active=-1;input.removeAttribute('aria-activedescendant');choices=QuickEntry.ranked(input.value,[...catalog,...state.custom],productEnglish).slice(0,8);options.innerHTML=choices.map((x,i)=>'<button type="button" role="option" aria-selected="false" id="pantry-option-'+i+'" data-choice="'+i+'"><span>'+esc(displayName(x.item.name))+'</span><span class="pantry-option-add" aria-hidden="true">'+(pantryBatch.includes(x.item.name)?'✓':'+')+'</span></button>').join('');input.setAttribute('aria-expanded',String(choices.length>0));options.querySelectorAll('button').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>stage([choices[Number(b.dataset.choice)].item.name],'')});paintBatch()};
 const stage=(parts,remainder)=>{if(saving)return;for(const text of parts.map(x=>x.trim()).filter(Boolean)){const name=QuickEntry.match(text,[...catalog,...state.custom,...pantryBatch.map(name=>({name}))],productEnglish);if(!pantryBatch.some(n=>QuickEntry.norm(n)===QuickEntry.norm(name)))pantryBatch.push(name)}input.value=remainder;paint();input.focus({preventScroll:true})};
 const apply=async target=>{
  if(saving||window.household?.busy)return;stage(input.value.split(/[,;\n]/),'');
  const names=pantryBatch.filter(n=>target==='home'||!pantryListed.has(QuickEntry.norm(n)));if(!names.length)return;
  const next=JSON.parse(JSON.stringify(state));for(const name of names){if(![...catalog,...next.custom].some(x=>QuickEntry.norm(x.name)===QuickEntry.norm(name)))next.custom.push({name,emoji:'🫙',category:'Saját tételek'});if(target==='home')next.stock[name]=2;else{const existing=next.cart.find(x=>QuickEntry.norm(x.name)===QuickEntry.norm(name));if(!existing)next.cart.push({name,quantity:1,unit:productUnit(name),done:false,source:'Gyors gyűjtés'});else if(existing.done){existing.done=false;existing.quantity=1}}}
  saving=true;input.readOnly=true;paintBatch();let success=false;
  try{if(window.household?.active){state=next;success=!!await window.household.notify()}else success=commitState(next);
   if(success){if(target==='list'){names.forEach(n=>pantryListed.add(QuickEntry.norm(n)));basketFeedback()}else homeUndo.length=0;feedback.textContent=target==='home'?say('A gyűjtés a készletbe került.','Collection added to pantry.'):say('Az új tételek a listára kerültek. A már átadottakat nem adjuk hozzá újra.','New items added to the list. Previously added items are not added again.');if(page==='pantry')refreshCatalog()}else feedback.textContent=say('Nem sikerült menteni. A gyűjtés megmaradt, próbáld újra.','Could not save. Your collection is kept; try again.');
  }finally{saving=false;input.readOnly=false;paint();if(q.open)input.focus({preventScroll:true})}
 };
 q.querySelector('#batch-home').onclick=()=>apply('home');q.querySelector('#batch-list').onclick=()=>apply('list');q.querySelector('#batch-clear').onclick=()=>{if(saving)return;pantryBatch=[];pantryListed.clear();input.value='';feedback.textContent='';paint();input.focus()};
 input.oninput=e=>{if(e.isComposing){pantryDraft=input.value;return}const parts=input.value.split(/[,;\n]/);if(parts.length>1)stage(parts.slice(0,-1),parts.at(-1));else paint()};input.oncompositionend=()=>input.dispatchEvent(new Event('input'));
 input.onpaste=e=>{const text=e.clipboardData?.getData('text');if(text&&/[,;\n]/.test(text)){e.preventDefault();input.value=input.value.slice(0,input.selectionStart)+text+input.value.slice(input.selectionEnd);input.dispatchEvent(new Event('input'))}};
 input.onkeydown=e=>{if(e.isComposing)return;if(['ArrowDown','ArrowUp'].includes(e.key)&&choices.length){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;options.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant','pantry-option-'+active);options.children[active].scrollIntoView({block:'nearest'})}if(e.key==='Enter'){e.preventDefault();stage([active>=0?choices[active].item.name:input.value],'')}};
 form.onsubmit=e=>{e.preventDefault();stage(input.value.split(/[,;\n]/),'')};
 const position=()=>{const v=window.visualViewport;q.style.top=(v?.offsetTop||0)+'px';q.style.bottom='auto';q.style.maxHeight=Math.max(120,(v?.height||innerHeight)-12)+'px'};
 q.querySelector('.close').onclick=()=>q.close();q.onclose=()=>{pantryDraft=input.value;window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position)};
 paint();q.showModal();position();window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);input.focus();
}

function setupHomeOverview(){
 const say=(hu,en)=>language==='en'?en:hu;
 const all=[...catalog,...state.custom.filter(i=>!catalog.some(c=>c.name===i.name))],home=all.filter(i=>state.stock[i.name]>0);
 const categories=categoryPriorityOrder.filter(c=>home.some(i=>i.category===c));
 const layout=main.querySelector('.catalog-layout'),rail=main.querySelector('.category-rail');rail.remove();layout.classList.add('home-overview');
 const heading=main.querySelector('.pantry-heading');heading.querySelector('h1').textContent=say('Készlet','Pantry');heading.querySelector('h1').setAttribute('data-no-translate','');
 const overview=document.createElement('div');overview.className='home-overview-tools';overview.setAttribute('data-no-translate','');
 overview.innerHTML='<div class="pantry-view-switch"><button data-home-view aria-pressed="true">'+say('Van otthon','At home')+' <span>'+home.length+'</span></button><button data-browse-catalog aria-pressed="false">'+say('Katalógus','Catalog')+'</button></div>'+(categories.length?'<div class="home-filters" aria-label="'+say('Otthoni kategóriák','Categories at home')+'"><button data-home-category="Minden" aria-pressed="'+(category==='Minden')+'">'+say('Összes','All')+'</button>'+categories.map(c=>'<button data-home-category="'+esc(c)+'" aria-pressed="'+(category===c)+'">'+categoryIcon(c)+'<span>'+esc(language==='en'?englishText(c):c)+'</span></button>').join('')+'</div>':'');
 layout.before(overview);overview.querySelector('[data-browse-catalog]').onclick=()=>{stockView='all';category='Minden';search='';renderPantry()};overview.querySelectorAll('[data-home-category]').forEach(b=>b.onclick=()=>{category=b.dataset.homeCategory;search='';renderPantry()});
}
