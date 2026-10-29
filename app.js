const initialStock=['Tojás','Tej','Vaj','Tejszín','Joghurt','Sajtkrém','Csirkemellsonka','Szalonna','Paprika','Konzerv gomba','Majonéz','Mustár','Piros Arany','Májkrém','Hummusz','Barack','Baracklekvár','Gyümölcslé','Csirkecomb','Borsó','Zöldségkeverék','Mirelit zöldség','Rizs','Jázminrizs','Tészta','Krumpli','Hagyma','Fokhagyma','Liszt','Olaj','Kenyér','Zabpehely','Búzadara','Zsemlemorzsa','Müzli','Só','Pirospaprika','Szójaszósz','Babérlevél','Bazsalikom','Majoranna','Szárított petrezselyem','Csirkeleveskocka','Fokhagymasó','Delikát','Almaecet','Málnás balzsamecet','Méz','Puding','Kakaópor','Vaníliás cukor','Cukor','Édesítőszer','Porcukor','Sütőpor'];
let state={stock:Object.fromEntries(initialStock.map(n=>[n,2])),custom:[],cart:[],likes:[],skips:[],chats:{},history:[]};
try{const saved=JSON.parse(localStorage.getItem('morzsa-v2')||localStorage.getItem('morzsa-v1'));if(saved&&saved.stock&&Array.isArray(saved.cart)&&Array.isArray(saved.likes))state={...state,...saved}}catch{}
if(!Array.isArray(state.history))state.history=[];
const homeUndo=[];
let page='pantry',category='Minden',stockView='all',search='' ,showSaved=false,currentId=null;const main=document.getElementById('main'),dialog=document.getElementById('detail');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem('morzsa-v2',JSON.stringify(state))}catch{toast('A böngésző nem engedte a mentést.')}updateCount()}
function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2300)}
function updateCount(){document.getElementById('cart-count').textContent=state.cart.filter(x=>!x.done).length||''}
function productCategory(name){return [...catalog,...state.custom].find(i=>i.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu'))?.category||'Egyéb'}
function productUnit(name){
 const overrides={'Krumpli':'kg','Édesburgonya':'kg','Hagyma':'kg','Sárgarépa':'kg','Alma':'kg','Barack':'kg','Banán':'kg','Fokhagyma':'db','Paprika':'db','Paradicsom':'db','Uborka':'db','Cukkini':'db','Padlizsán':'db','Citrom':'db','Lime':'db','Avokádó':'db','Tojás':'db','Tej':'l','Olaj':'l','Olívaolaj':'üveg','Vaj':'csomag','Tejszín':'doboz','Joghurt':'pohár','Sajtkrém':'doboz','Tejföl':'pohár','Rizs':'kg','Jázminrizs':'kg','Liszt':'kg','Cukor':'kg','Csirkecomb':'kg','Csirkemell':'kg','Szalonna':'csomag','Fogkrém':'db','Fogkefe':'db','Szájvíz':'üveg','Cumisüveg':'db','Cumi':'db','Száraz kutyaeledel':'kg','Száraz macskaeledel':'kg','Nedves kutyaeledel':'doboz','Nedves macskaeledel':'doboz','Szemetesvödör':'db','Ételtároló doboz':'db'};
 if(overrides[name])return overrides[name];
 const c=productCategory(name);return {'Zöldségek':'db','Gyümölcsök':'db','Hús és felvágott':'kg','Hal és tengeri':'kg','Konzervek és hüvelyesek':'doboz','Italok':'üveg','Szószok és olajok':'üveg','Fűszerek':'csomag','Tejtermék és tojás':'csomag','Háztartás':'csomag','Tisztálkodás és szépségápolás':'db','Fogápolás és higiénia':'csomag','Otthoni apróságok':'db','Takarítás és mosás':'db','Sör, bor és szeszes italok':'üveg','Lekvárok és kenhető krémek':'üveg','Készételek és gyors fogások':'doboz'}[c]||'csomag';
}
function cartAmount(x){return (x.quantity||1)+' '+(x.unit||productUnit(x.name))}
function addCart(name,source='Készlet',quantity=1,unit=null){
 name=[...catalog,...state.custom].find(i=>i.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu'))?.name||name;
 const found=state.cart.find(x=>x.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu')),chosenUnit=unit||(!found?.done&&found?.unit)||productUnit(name);
 if(found){if(found.done){found.done=false;found.quantity=quantity;found.unit=chosenUnit}else{if(found.unit&&found.unit!==chosenUnit){toast('Eltérő egység: módosítsd a mennyiséget a listán.');return false}found.quantity=(found.quantity||1)+quantity;found.unit=chosenUnit}}
 else state.cart.push({name,source,quantity,unit:chosenUnit,done:false});save();return true;
}
function openQuantity(name,edit=false){
 const existing=state.cart.find(x=>x.name.toLocaleLowerCase('hu')===name.toLocaleLowerCase('hu')),q=document.getElementById('quantity-dialog');edit=!!existing;let quantity=existing?.quantity||1;
 q.innerHTML='<button class="close" aria-label="Mennyiségválasztó bezárása">×</button><div class="eyebrow">'+(edit?'A LISTÁDON':'LISTÁHOZ ADÁS')+'</div><h2>'+esc(name)+'</h2><p class="quantity-caption">'+(edit?'A listán szereplő teljes mennyiség:':'Mennyit szeretnél a listára tenni?')+'</p><div class="quantity-presets">'+[1,2,3,5].map(n=>'<button data-quantity="'+n+'" aria-pressed="'+(quantity===n)+'">'+n+'</button>').join('')+'</div><div class="quantity-fields"><label>Egységek<input id="quantity-number" type="number" min="1" max="99" step="1" value="'+quantity+'" inputmode="numeric"></label><label>Egység<select id="quantity-unit">'+['db','kg','g','l','csomag','doboz','üveg','pohár'].map(u=>'<option '+((existing?.unit||productUnit(name))===u?'selected':'')+'>'+u+'</option>').join('')+'</select></label></div><p class="quantity-total" aria-live="polite"></p><p class="quantity-error" role="alert"></p><button class="primary full" id="quantity-confirm">'+(edit?'Mennyiség mentése':'Hozzáadom')+'</button>';
 const input=q.querySelector('#quantity-number'),unit=q.querySelector('#quantity-unit');
 const update=()=>{q.querySelector('.quantity-total').textContent=input.value+' '+unit.value;q.querySelectorAll('[data-quantity]').forEach(b=>b.setAttribute('aria-pressed',String(Number(input.value)===Number(b.dataset.quantity))))};
 q.querySelectorAll('[data-quantity]').forEach(b=>b.onclick=()=>{input.value=b.dataset.quantity;update()});input.oninput=update;unit.onchange=update;q.querySelector('.close').onclick=()=>q.close();
 q.querySelector('#quantity-confirm').onclick=()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<1||n>99){q.querySelector('.quantity-error').textContent='1 és 99 közötti egész számot adj meg.';return}if(existing){const next={...state,cart:state.cart.map(x=>x===existing?{...x,quantity:n,unit:unit.value}:x)};if(!commitState(next)){q.querySelector('.quantity-error').textContent='Nem sikerült menteni. Próbáld újra.';return}}else if(!addCart(name,'Készlet',n,unit.value))return;q.close();toast(name+' · '+n+' '+unit.value);if(page==='pantry')refreshCatalog();else renderShopping()};update();q.showModal();
}
function bindAddButton(button,name){
 let timer=null,held=false,start=null;
 const cancel=()=>{clearTimeout(timer);timer=null};
 button.addEventListener('pointerdown',e=>{if(e.button!==0)return;held=false;start=[e.clientX,e.clientY];timer=setTimeout(()=>{held=true;openQuantity(name)},450)});
 button.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start[0],e.clientY-start[1])>10)cancel()});
 button.addEventListener('pointerup',cancel);button.addEventListener('pointercancel',cancel);button.addEventListener('pointerleave',cancel);
 button.addEventListener('contextmenu',e=>{e.preventDefault();cancel();if(!held){held=true;openQuantity(name)}});
 button.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&e.altKey){e.preventDefault();cancel();openQuantity(name)}else if(e.key==='Enter'||e.key===' '){held=false}});button.setAttribute('aria-keyshortcuts','Alt+ArrowDown');
 button.onclick=()=>{cancel();if(held){held=false;return}if(addCart(name)){const x=state.cart.find(x=>x.name===name);toast(name+' · '+cartAmount(x));refreshCatalog()}};
}
function missing(r){return r.ingredients.filter(([n])=>!state.stock[n])}
function score(r){const liked=recipes.filter(x=>state.likes.includes(x.id));return (r.ingredients.length-missing(r).length)/r.ingredients.length*10+liked.reduce((sum,x)=>sum+r.tags.filter(t=>x.tags.includes(t)).length,0)*.5}
function nextRecipe(){return [...recipes].filter(r=>!state.likes.includes(r.id)&&!state.skips.includes(r.id)).sort((a,b)=>score(b)-score(a))[0]}
function hero(label,title,desc){return '<section class="hero"><div class="eyebrow">'+label+'</div><h1>'+title+'</h1><p class="subtitle">'+desc+'</p></section>'}
function render(){document.querySelector('.app').dataset.page=page;document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false')});updateCount();if(page==='pantry')renderPantry();if(page==='recipes')renderRecipes();if(page==='shopping')renderShopping()}
const houseIcon='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9"/></svg>';
let categoryRailScroll=0,sortMode=state.sortMode==='alpha'?'alpha':'importance';
function compareProducts(a,b){return sortMode==='alpha'?a.name.localeCompare(b.name,'hu'):(householdPriority.get(a.name)??9999)-(householdPriority.get(b.name)??9999)||a.name.localeCompare(b.name,'hu')}
function renderPantry(){
 const all=[...catalog,...state.custom.filter(item=>!catalog.some(c=>c.name.toLocaleLowerCase('hu')===item.name.toLocaleLowerCase('hu')))],norm=s=>s.toLocaleLowerCase('hu').normalize('NFD').replace(/[̀-ͯ]/g,''),hasCart=n=>state.cart.some(x=>x.name===n&&!x.done);
 const matchingItems=()=>all.filter(i=>(search.trim()||category==='Minden'||i.category===category)&&(stockView!=='home'||state.stock[i.name]>0)&&norm(i.name).includes(norm(search.trim()))).sort(compareProducts);
 const cats=['Minden',...categoryPriorityOrder.filter(c=>catalogGroups.some(g=>g[0]===c)),...(state.custom.length?['Saját tételek']:[])];
 main.innerHTML='<div class="pantry-heading"><h1>'+(stockView==='home'?'Van otthon':'Készlet')+'</h1><span>'+all.filter(i=>state.stock[i.name]>0).length+' otthon</span></div><div class="catalog-search-row"><div class="search-wrap"><span aria-hidden="true">⌕</span><input id="catalog-search" type="search" aria-label="Keresés az alapanyagok között" placeholder="Mit keresel?" value="'+esc(search)+'"></div><button id="sort-toggle" class="sort-toggle" aria-label="'+(sortMode==='alpha'?'Rendezés: ABC. Váltás fontossági sorrendre.':'Rendezés: fontosság. Váltás ABC-sorrendre.')+'" aria-pressed="'+(sortMode==='alpha')+'">'+(sortMode==='alpha'?'ABC':'★')+'<span aria-hidden="true">↕</span></button></div><p class="helper">⌂ otthon · + a listára · hosszan: mennyiség</p><div class="catalog-layout"><aside class="category-rail" aria-label="Alapanyag-kategóriák"><button data-home-view aria-label="Van otthon nézet" aria-pressed="'+(stockView==='home')+'" class="home-view '+(stockView==='home'?'active':'')+'"><span aria-hidden="true">'+houseIcon+'</span><span>Van otthon</span></button>'+cats.map(c=>{const g=catalogGroups.find(g=>g[0]===c),icon=g?.[1]||(c==='Minden'?'▦':'🫙');const label=({'Gyümölcsök':'Gyümölcs','Hús és felvágott':'Húsok','Hal és tengeri':'Halak','Tejtermék és tojás':'Tej és tojás','Növényi alapok':'Növényi','Rizs és tészta':'Rizs, tészta','Konzervek és hüvelyesek':'Konzervek','Szószok és olajok':'Szósz, olaj','Sütés és édesség':'Sütés','Reggeli és rágcsálnivaló':'Reggeli','Saját tételek':'Saját','Lekvárok és kenhető krémek':'Lekvár, méz','Magvak és rágcsálnivalók':'Magvak, nasi','Készételek és gyors fogások':'Készételek','Sör, bor és szeszes italok':'Sör, bor','Takarítás és mosás':'Takarítás','Papír és konyhai kellékek':'Papír, konyha','Tisztálkodás és szépségápolás':'Testápolás','Fogápolás és higiénia':'Higiénia','Baba és kisgyerek':'Baba','Állateledel és kellékek':'Kisállat','Otthoni apróságok':'Otthon'})[c]||c;const active=stockView!=='home'&&category===c;return '<button data-rail-category="'+esc(c)+'" aria-label="Kategória: '+esc(c)+'" aria-pressed="'+active+'" class="'+(active?'active':'')+'"><span aria-hidden="true">'+icon+'</span><span>'+label+'</span></button>'}).join('')+'</aside><div class="catalog-content"><div id="catalog-results">'+catalogRows(matchingItems(),hasCart)+'</div></div></div><form class="add-form" id="add-item"><input aria-label="Új alapanyag" placeholder="Saját tétel hozzáadása…" maxlength="60" required><button aria-label="Alapanyag hozzáadása">+</button></form>';
 if(homeUndo.length){const last=homeUndo[homeUndo.length-1],notice=document.createElement('div');notice.className='undo-home';notice.innerHTML='<span>'+esc(last.name)+' kivéve az otthoniak közül.</span><button>Visszavonás</button>';main.querySelector('.pantry-heading').after(notice);notice.querySelector('button').onclick=()=>{if(commitState({...state,stock:{...state.stock,[last.name]:last.value}})){homeUndo.pop();refreshCatalog()}}}
 const rail=main.querySelector('.category-rail');rail.scrollTop=categoryRailScroll;rail.onscroll=()=>{categoryRailScroll=rail.scrollTop};
 main.querySelector('[data-home-view]').onclick=()=>{stockView='home';category='Minden';search='';renderPantry()};
 main.querySelectorAll('[data-rail-category]').forEach(b=>b.onclick=()=>{category=b.dataset.railCategory;stockView='all';search='';collapsedCategories.delete(category);renderPantry();main.querySelector('.catalog-layout').scrollIntoView({block:'start',behavior:'instant'})});
 main.querySelector('#sort-toggle').onclick=()=>{sortMode=sortMode==='alpha'?'importance':'alpha';state.sortMode=sortMode;save();renderPantry()};
 main.querySelector('#catalog-search').oninput=e=>{search=e.target.value;main.querySelector('#catalog-results').innerHTML=catalogRows(matchingItems(),hasCart);bindCatalog()};
 main.querySelector('#add-item').onsubmit=e=>{e.preventDefault();const name=e.target.querySelector('input').value.trim();if(!name)return;const found=all.find(i=>norm(i.name)===norm(name));if(found)state.stock[found.name]=2;else{state.custom.push({name,emoji:'🫙',category:'Saját tételek'});state.stock[name]=2}save();toast('Otthonra jelölve.');renderPantry()};
 bindCatalog();
}
const collapsedCategories=new Set();
function ingredientCard(i,hasCart){
 const home=state.stock[i.name]>0,basket=hasCart(i.name),amount=basket?cartAmount(state.cart.find(x=>x.name===i.name&&!x.done)):null;
 return '<div class="ingredient-card '+(home?'at-home':'')+' '+(basket?'in-cart':'')+'" data-ingredient="'+esc(i.name)+'"><button class="home-action '+(home?'selected':'')+'" data-home="'+esc(i.name)+'" aria-label="'+esc(i.name)+': van otthon" aria-pressed="'+home+'">'+houseIcon+'</button><div class="ingredient-center" data-card-drag="'+esc(i.name)+'"><span class="ingredient-icon" aria-hidden="true">'+(productArtwork[i.name]?'<img class="product-artwork" src="'+productArtwork[i.name]+'" alt="" draggable="false" width="40" height="40">':i.emoji)+'</span><span class="ingredient-copy"><span class="ingredient-name">'+esc(i.name)+'</span><span class="ingredient-status">'+(basket?'<span class="cart-status">Listán · '+esc(amount)+'</span>':'')+'</span></span></div><button class="ingredient-plus '+(basket?'selected':'')+'" data-basket="'+esc(i.name)+'" aria-label="'+esc(i.name)+': egy egység hozzáadása" aria-description="Hosszan nyomva mennyiséget választhatsz">+</button></div>';
}
function catalogRows(items,hasCart){
 if(!items.length)return '<div class="empty">Nincs találat. Próbálj más nevet, vagy adj hozzá saját tételt.</div>';
 const grid=group=>'<div class="ingredient-grid">'+group.map(i=>ingredientCard(i,hasCart)).join('')+'</div>';
 if(search.trim()||category!=='Minden'||stockView==='home')return grid(items);
 return categoryPriorityOrder.filter(c=>items.some(i=>i.category===c)).map(c=>{
 const group=items.filter(i=>i.category===c),icon=catalogGroups.find(g=>g[0]===c)?.[1]||'🫙';
 return '<details class="catalog-section" data-collapse="'+esc(c)+'" '+(!collapsedCategories.has(c)?'open':'')+'><summary><span class="category-icon" aria-hidden="true">'+icon+'</span><span class="category-title">'+esc(c)+'</span><span class="category-count">'+group.length+'</span><span class="category-chevron" aria-hidden="true">⌄</span></summary>'+grid(group)+'</details>';
 }).join('');
}
function bindCatalog(){
 main.querySelectorAll('[data-collapse]').forEach(d=>d.ontoggle=()=>{if(d.open)collapsedCategories.delete(d.dataset.collapse);else collapsedCategories.add(d.dataset.collapse)});
 main.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>{const n=b.dataset.home,previous=state.stock[n]||0;if(commitState({...state,stock:{...state.stock,[n]:previous>0?0:2}})){for(let i=homeUndo.length-1;i>=0;i--)if(homeUndo[i].name===n)homeUndo.splice(i,1);if(previous>0)homeUndo.push({name:n,value:previous});refreshCatalog()}});
 main.querySelectorAll('[data-basket]').forEach(b=>bindAddButton(b,b.dataset.basket));
 main.querySelectorAll('[data-card-drag]').forEach(center=>bindIngredientDrag(center));
}
function bindIngredientDrag(center){
 let origin=null,moved=false,dx=0;const card=center.closest('.ingredient-card');
 const reset=()=>{center.style.transform='';card.classList.remove('drag-home','drag-cart');origin=null};
 center.addEventListener('pointerdown',e=>{if(e.button!==0)return;origin={x:e.clientX,y:e.clientY};dx=0;moved=false;center.setPointerCapture(e.pointerId)});
 center.addEventListener('pointermove',e=>{if(!origin)return;dx=e.clientX-origin.x;const dy=e.clientY-origin.y;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){reset();return}moved=Math.abs(dx)>12;center.style.transform='translateX('+Math.max(-36,Math.min(36,dx))+'px)';card.classList.toggle('drag-home',dx<-20);card.classList.toggle('drag-cart',dx>20)});
 center.addEventListener('pointerup',()=>{if(!origin)return;const n=center.dataset.cardDrag,act=moved&&Math.abs(dx)>=28?Math.sign(dx):0;reset();if(act<0){state.stock[n]=2;save();toast(n+' otthonra jelölve.');refreshCatalog()}else if(act>0){if(addCart(n)){toast(n+' a listára került.');refreshCatalog()}}});
 center.addEventListener('pointercancel',reset);center.addEventListener('lostpointercapture',reset);
}
function refreshCatalog(){const scroll=window.scrollY;renderPantry();window.scrollTo(0,scroll)}
function renderRecipes(){const r=nextRecipe();currentId=r?.id;main.innerHTML=hero('EGY KIS INSPIRÁCIÓ','Mihez lenne<br>ma kedved?','A készletedből indulunk. Az ízlésedhez igazodunk.')+'<div class="recipe-toolbar"><span>'+state.likes.length+' kedvenc · 2 adaghoz</span><button class="small-button" id="saved-toggle">'+(showSaved?'Új ötletek':'Kedvenceim ♡')+'</button></div>';if(showSaved){main.innerHTML+=state.likes.length?state.likes.map(id=>recipes.find(r=>r.id===id)).filter(Boolean).map(r=>'<div class="saved-row"><span>'+r.emoji+'</span><button data-recipe="'+r.id+'">'+r.name+'</button><button class="delete" data-unlike="'+r.id+'" aria-label="Kedvenc eltávolítása">×</button></div>').join(''):'<div class="empty"><span>♡</span>Itt gyűlnek majd a kedvenceid.<br>Húzz jobbra egy receptet!</div>';main.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>openRecipe(b.dataset.recipe));main.querySelectorAll('[data-unlike]').forEach(b=>b.onclick=()=>{state.likes=state.likes.filter(id=>id!==b.dataset.unlike);save();render()});return}if(!r){main.innerHTML+='<div class="empty"><span>✳</span>Végignézted az első receptválogatást.</div><button class="primary full" id="again">A kihagyottak újra</button>';main.querySelector('#again').onclick=()=>{state.skips=[];save();render()};return}const m=missing(r);main.innerHTML+='<article class="recipe-card" id="recipe-card" aria-label="'+r.name+'"><div class="recipe-art"><div class="plate" aria-hidden="true">'+r.emoji+'</div><span class="art-label">Illusztráció</span></div><div class="recipe-body"><span class="match">'+(m.length?m.length+' hozzávaló hiányzik':'Minden hozzávaló megvan ✓')+'</span><h2>'+r.name+'</h2><div class="recipe-meta">◷ '+r.time+' perc &nbsp; · &nbsp; 2 adag &nbsp; · &nbsp; '+r.tags[0]+'</div><p>'+r.desc+'</p></div></article><div class="actions"><button class="round" id="skip" aria-label="Most kihagyom">×</button><button class="round info" id="info" aria-label="Recept megnyitása">≡</button><button class="round like" id="like" aria-label="Recept kedvelése">♡</button></div><p class="swipe-hint">Balra: most nem · Jobbra: jöhet máskor is</p>';main.querySelector('#skip').onclick=()=>vote(false);main.querySelector('#like').onclick=()=>vote(true);main.querySelector('#info').onclick=()=>openRecipe(r.id);swipe(main.querySelector('#recipe-card'),dir=>vote(dir>0))}
function vote(like){if(!currentId)return;(like?state.likes:state.skips).push(currentId);save();toast(like?'Elmentve a kedvenceid közé ♡':'Most kihagytuk.');render()}
const chatRequests=new Map();let aiConfigured=false;
async function checkAI(){try{const res=await fetch('/api/status');const data=await res.json();aiConfigured=!!data.configured}catch{aiConfigured=false}const el=dialog.querySelector('.ai-status');if(el)el.textContent=aiConfigured?'AI készen áll':'AI még nincs bekapcsolva'}
function openRecipe(id){
 const r=recipes.find(x=>x.id===id);if(!r)return;const m=missing(r);
 dialog.dataset.recipe=id;
 dialog.innerHTML='<button class="close" aria-label="Bezárás">×</button><div class="eyebrow">'+r.time+' PERC · 2 ADAG</div><h2>'+r.name+'</h2><h3>Hozzávalók</h3><ul>'+r.ingredients.map(([n,q])=>'<li>'+esc(n)+' · '+q+(!state.stock[n]?' <strong>— nincs otthon jelölve</strong>':'')+'</li>').join('')+'</ul><h3>Így készül</h3><ol>'+r.steps.map(s=>'<li>'+s+'</li>').join('')+'</ol><button class="primary full" id="cook">'+(m.length?'Ma ezt főzöm · '+m.length+' tétel a listára':'Ma ezt főzöm ✓')+'</button><section class="chat-section" aria-label="Beszélgetés erről a receptről"><div class="chat-heading"><h3>Beszéljük meg ✳</h3><span class="ai-status">AI csatlakozás…</span></div><p class="chat-hint">Helyettesítés, más adagszám, segítség főzés közben. Ez a beszélgetés ennél a receptnél marad.</p><div class="chat-suggestions">'+['Mivel helyettesíthetem?','Négy főre készíteném','Segíts lépésről lépésre'].map(t=>'<button class="small-button" data-chat-suggestion="'+t+'">'+t+'</button>').join('')+'</div><div class="chat-messages" aria-live="polite"></div><div class="chat-pending" role="status"></div><p class="chat-error" role="alert"></p><button class="small-button" id="chat-retry" hidden>Újrapróbálom</button><form class="chat-form"><textarea rows="2" maxlength="2000" placeholder="Kérdezz erről az ételről…" aria-label="Kérdés a recepthez" required></textarea><button class="primary" aria-label="Kérdés küldése">↑</button></form><p class="chat-hint">A kérdés, a recept és az otthon jelölt élelmiszerek az OpenAI-hoz kerülnek. Az AI válaszát érdemes ellenőrizni.</p></section>';
 dialog.querySelector('.close').onclick=()=>dialog.close();
 dialog.querySelector('#cook').onclick=()=>{m.forEach(([n,q])=>addCart(n,r.name+' · '+q));if(!state.likes.includes(id))state.likes.push(id);save();dialog.close();toast(m.length?'A hozzávalók a listán.':'Jó főzést!');if(m.length)page='shopping';render()};
 dialog.querySelector('.chat-form').onsubmit=e=>{e.preventDefault();const input=e.target.querySelector('textarea'),text=input.value.trim();if(!text||chatRequests.has(id))return;state.chats[id]||=[];state.chats[id].push({role:'user',content:text});input.value='';save();sendChat(id)};
 dialog.querySelectorAll('[data-chat-suggestion]').forEach(b=>b.onclick=()=>{const input=dialog.querySelector('textarea');input.value=b.dataset.chatSuggestion;input.focus()});
 dialog.querySelector('#chat-retry').onclick=()=>sendChat(id);
 paintChat(id);checkAI();if(!dialog.open)dialog.showModal();
}
function paintChat(id){if(dialog.dataset.recipe!==id)return;const history=state.chats[id]||[];
 dialog.querySelector('.chat-messages').innerHTML=history.map(m=>'<div class="chat-message '+m.role+'"><span class="speaker">'+(m.role==='user'?'Te':'Morzsa AI')+'</span>'+esc(m.content)+'</div>').join('');
 const busy=chatRequests.has(id);dialog.querySelector('.chat-form button').disabled=busy;dialog.querySelector('.chat-pending').textContent=busy?'Morzsa gondolkodik…':'';
 dialog.querySelector('#chat-retry').hidden=busy||!history.length||history[history.length-1].role!=='user';
}
async function sendChat(id){if(chatRequests.has(id))return;const controller=new AbortController();chatRequests.set(id,controller);if(dialog.dataset.recipe===id)dialog.querySelector('.chat-error').textContent='';paintChat(id);const timeout=setTimeout(()=>controller.abort(),65000);
 try{const history=state.chats[id]||[],recipe=recipes.find(r=>r.id===id);const foodNames=new Set(catalog.filter(i=>!nonFoodCategories.has(i.category)).map(i=>i.name));state.custom.filter(i=>!nonFoodCategories.has(productCategory(i.name))).forEach(i=>foodNames.add(i.name));const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipe,messages:history.slice(-24).map(m=>({role:m.role,content:m.content.slice(0,8000)})),stock:Object.keys(state.stock).filter(n=>state.stock[n]>0&&foodNames.has(n))}),signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'Az AI most nem elérhető.');if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('Nem érkezett válasz.');state.chats[id].push({role:'assistant',content:data.reply});save();
 }catch(error){if(dialog.dataset.recipe===id)dialog.querySelector('.chat-error').textContent=error.name==='AbortError'?'Túl sokáig tartott a válasz. Próbáld újra.':error.message||'Nem sikerült kapcsolódni.';
 }finally{clearTimeout(timeout);chatRequests.delete(id);paintChat(id)}
}
function renderShopping(){
 const pending=state.cart.filter(x=>!x.done).length,order=categoryPriorityOrder;
 const groups=[...new Set(state.cart.map(x=>productCategory(x.name)))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
 main.innerHTML='<div class="pantry-heading"><h1>Bevásárlólista</h1><span>'+pending+' tétel</span></div>'+(state.cart.length?groups.map(c=>'<details class="shopping-group" open><summary><span aria-hidden="true">'+(catalogGroups.find(g=>g[0]===c)?.[1]||'🫙')+'</span><span>'+esc(c)+'</span><small>'+state.cart.filter(x=>productCategory(x.name)===c&&!x.done).length+'</small></summary>'+state.cart.map((x,i)=>({x,i})).filter(({x})=>productCategory(x.name)===c).sort((a,b)=>compareProducts(a.x,b.x)).map(({x,i})=>'<div class="list-row '+(x.done?'done':'')+'"><input type="checkbox" id="cart-'+i+'" data-cart="'+i+'" '+(x.done?'checked':'')+'><label for="cart-'+i+'">'+esc(x.name)+'</label><button class="quantity-badge" data-edit-quantity="'+i+'" aria-label="'+esc(x.name)+': mennyiség módosítása">'+esc(cartAmount(x))+'</button><button class="delete" data-delete="'+i+'" aria-label="'+esc(x.name)+' törlése">×</button></div>').join('')+'</details>').join(''):'<div class="empty"><span>🧺</span>Most üres a kosarad.<br>A készletben a + gombbal adhatsz hozzá.</div>')+'<form class="add-form" id="add-cart"><input aria-label="Új bevásárlótétel" placeholder="Még valami a listára…" maxlength="60" required><button aria-label="Listára vétel">+</button></form>'+(state.cart.length?'<button class="primary full" id="restock">Vásárlás befejezése</button><p class="helper">A teljes lista az archívumba kerül, minden tétel otthonra lesz jelölve.</p>':'');
 main.querySelectorAll('[data-cart]').forEach(i=>i.onchange=()=>{state.cart[Number(i.dataset.cart)].done=i.checked;save();renderShopping()});
 main.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{state.cart.splice(Number(b.dataset.delete),1);save();renderShopping()});
 main.querySelectorAll('[data-edit-quantity]').forEach(b=>b.onclick=()=>openQuantity(state.cart[Number(b.dataset.editQuantity)].name,true));
 main.querySelector('#add-cart').onsubmit=e=>{e.preventDefault();const n=e.target.querySelector('input').value.trim();if(n){addCart(n,'Saját tétel');renderShopping()}};
 const restock=main.querySelector('#restock');if(restock)restock.onclick=()=>finishShopping();
 const actions=document.createElement('div');actions.className='shopping-actions';actions.innerHTML='<button class="small-button" id="open-history">Korábbi listák · '+state.history.length+'</button>'+(state.cart.length?'<button class="small-button" id="clear-cart">Lista törlése</button>':'');main.querySelector('.pantry-heading').after(actions);actions.querySelector('#open-history').onclick=openArchive;const clear=actions.querySelector('#clear-cart');if(clear)clear.onclick=confirmClearCart;
}
function swipe(el,callback){let x=0,y=0,active=false;el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;if(e.target.closest('button')&&e.target.closest('button')!==el)return;x=e.clientX;y=e.clientY;active=true;el.setPointerCapture(e.pointerId)});el.addEventListener('pointermove',e=>{if(!active)return;const dx=e.clientX-x,dy=e.clientY-y;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>15){active=false;el.style.transform='';return}if(Math.abs(dx)>15)el.style.transform='translateX('+Math.max(-90,Math.min(90,dx))+'px) rotate('+(dx/30)+'deg)'});const end=e=>{if(!active)return;active=false;el.style.transform='';const dx=e.clientX-x;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(e.clientY-y)){callback(dx>0?1:-1)}};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',()=>{active=false;el.style.transform=''})}
main.addEventListener('click',e=>{if(e.target.closest('#saved-toggle')){showSaved=!showSaved;render()}}); document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{page=b.dataset.page;render();window.scrollTo({top:0,behavior:'instant'})});document.querySelector('.brand').onclick=e=>{e.preventDefault();page='pantry';render();window.scrollTo(0,0)};dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});render();

function commitState(next){
 try{localStorage.setItem('morzsa-v2',JSON.stringify(next))}catch{toast('Nem sikerült menteni. Semmit sem módosítottunk.');return false}
 state=next;updateCount();return true;
}
function finishShopping(){
 if(!state.cart.length)return;
 const items=state.cart.map(x=>({...x,done:true,quantity:x.quantity||1,unit:x.unit||productUnit(x.name),category:productCategory(x.name)}));
 const next=JSON.parse(JSON.stringify(state));
 next.history.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),kind:'purchase',items});
 next.cart=[];
 items.forEach(x=>{next.stock[x.name]=2;if(![...catalog,...next.custom].some(i=>i.name===x.name))next.custom.push({name:x.name,emoji:'🫙',category:'Saját tételek'})});
 if(commitState(next)){toast('Vásárlás elmentve. Minden tétel az otthoni készletbe került.');renderShopping()}
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
  else next.cart.push({name:item.name,source:'Archívum',quantity:item.quantity,unit:item.unit,done:false});
 }
 if(!commitState(next))return false;
 renderShopping();toast('Hozzáadva; a meglévő mennyiségeket összeadtuk.');return true;
}
function openArchive(){
 const q=document.getElementById('history-dialog');
 q.innerHTML='<button class="close" aria-label="Archívum bezárása">×</button><h2>Korábbi listák</h2><p class="helper">Ezen a böngészőn mentve. Újra hozzáadáskor a mennyiségek összeadódnak.</p><p id="archive-feedback" role="status"></p>'+(!state.history.length?'<div class="empty">Még nincs mentett listád.</div>':state.history.map(entry=>{
 const categories=[...new Set(entry.items.map(x=>x.category||productCategory(x.name)))];
 return '<details class="archive-entry"><summary><span><strong>'+(entry.kind==='purchase'?'Vásárlás':'Ürítés előtt mentve')+'</strong><small>'+esc(new Date(entry.date).toLocaleString('hu-HU',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))+' · '+entry.items.length+' tétel</small></span></summary>'+categories.map(c=>'<h3>'+esc(c)+'</h3>'+entry.items.filter(x=>(x.category||productCategory(x.name))===c).map(x=>'<div class="archive-row"><span>'+esc(x.name)+(entry.kind==='cleared'&&x.done?' ✓':'')+'</span><span>'+esc(cartAmount(x))+'</span></div>').join('')).join('')+'<button class="small-button full" data-restore="'+esc(entry.id)+'">Újra a listára +</button></details>';
 }).join(''));
 q.querySelector('.close').onclick=()=>q.close();q.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{if(restoreArchive(b.dataset.restore)){b.disabled=true;b.textContent='Hozzáadva ✓';q.querySelector('#archive-feedback').textContent='Hozzáadva a bevásárlólistához.'}else q.querySelector('#archive-feedback').textContent=document.getElementById('toast').textContent});q.showModal();
}
