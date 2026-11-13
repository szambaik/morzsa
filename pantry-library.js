// A quieter pantry view using the existing catalog, saved state and shared actions.
renderPantry=function(){
 const say=(hu,en)=>language==='en'?en:hu;
 const all=[...catalog,...state.custom.filter(item=>!catalog.some(c=>QuickEntry.norm(c.name)===QuickEntry.norm(item.name)))];
 const hasCart=n=>state.cart.some(x=>x.name===n),query=()=>QuickEntry.norm(search.trim());
 const matching=()=>all.filter(i=>(category==='Minden'||i.category===category)&&(query()||stockView!=='home'||state.stock[i.name]>0)&&(!query()||QuickEntry.norm(i.name).includes(query())||QuickEntry.norm(productEnglish[i.name]||'').includes(query()))).sort(compareProducts);
 const cats=[...new Set(all.map(i=>i.category))].sort((a,b)=>categoryPriorityOrder.indexOf(a)-categoryPriorityOrder.indexOf(b));
 main.innerHTML='<section class="pantry-library" data-no-translate><div class="pantry-heading"><div><p class="workspace-eyebrow">'+say('Konyhánk','Our kitchen')+'</p><h1>'+say('Mi van otthon?','What’s at home?')+'</h1></div><details class="pantry-tools"><summary aria-label="'+say('Készlet műveletek','Pantry actions')+'"><img src="assets/ui/menu.svg" alt="" width="20" height="20"></summary><button class="small-button" data-secondary-cart>'+say('Felírok a listára','Add to shopping list')+'</button><button class="small-button" id="clear-stock">'+say('Készlet ürítése','Clear pantry')+'</button><button class="small-button" id="sort-toggle">'+(sortMode==='alpha'?say('Relevancia szerinti rendezés','Sort by relevance'):say('ABC szerinti rendezés','Sort alphabetically'))+'</button><label>'+say('Kategória','Category')+'<select id="pantry-category"><option value="Minden">'+say('Minden','All')+'</option>'+cats.map(c=>'<option value="'+esc(c)+'" '+(c===category?'selected':'')+'>'+esc(language==='en'?englishText(c):c)+'</option>').join('')+'</select></label></details></div><p class="pantry-intro">'+say('Egy jó emlékeztető. Mennyiséget csak akkor írj, ha segít.','A useful reminder. Add quantities only when they help.')+'</p><div class="pantry-library-filters"><button data-pantry-view="home" aria-pressed="'+(stockView==='home')+'">'+say('Van otthon','At home')+'</button><button data-pantry-view="all" aria-pressed="'+(stockView==='all')+'">'+say('Minden','All')+'</button><span>'+all.filter(i=>state.stock[i.name]>0).length+say(' alapanyag',' ingredients')+'</span></div><form class="pantry-inline-search"><img src="assets/ui/search.svg" alt="" width="20" height="20"><input id="catalog-search" type="search" aria-label="'+say('Keresés az alapanyagok között','Search ingredients')+'" placeholder="'+say('Keresés vagy hozzáadás…','Search or add…')+'" value="'+esc(search)+'"><button type="submit" aria-label="'+say('Készlethez adás','Add to pantry')+'"><img src="assets/ui/plus.svg" alt="" width="22" height="22"></button></form><div id="catalog-results"></div></section>';
 const results=main.querySelector('#catalog-results'),input=main.querySelector('#catalog-search');
 const paint=()=>{const items=matching();results.innerHTML=items.length?'<div class="ingredient-grid">'+items.map(i=>ingredientCard(i,hasCart)).join('')+'</div>':catalogRows([],hasCart);bindCatalog();bindAvailability();window.PantryReview?.mount()};
 main.querySelectorAll('[data-pantry-view]').forEach(b=>b.onclick=()=>{stockView=b.dataset.pantryView;category='Minden';search='';renderPantry()});
 input.oninput=()=>{search=input.value;paint()};
 main.querySelector('.pantry-inline-search').onsubmit=e=>{e.preventDefault();window.MorzsaWorkspace?.quick('stock',input.value)};
 main.querySelector('#pantry-category').onchange=e=>{category=e.target.value;renderPantry()};
 main.querySelector('[data-secondary-cart]').onclick=()=>window.MorzsaWorkspace.quick('cart');
 main.querySelector('#clear-stock').onclick=confirmClearStock;
 main.querySelector('#sort-toggle').onclick=()=>{sortMode=sortMode==='alpha'?'importance':'alpha';state.sortMode=sortMode;save();renderPantry()};
 paint();window.MorzsaWorkspace?.mount();
};
const pantryStateLabel=value=>{const labels={home:['Van otthon','At home'],low:['Kevés','Running low'],out:['Elfogyott','Used up'],unknown:['Nincs jelölve','Not marked']};return labels[value][language==='en'?1:0]};
ingredientCard=function(i,hasCart){
 const status=WorkspaceEntry.availability(state.stock[i.name],Object.hasOwn(state.stock,i.name)),basket=hasCart(i.name),say=(hu,en)=>language==='en'?en:hu;
 return '<div class="ingredient-card '+(state.stock[i.name]>0?'at-home':'')+' '+(basket?'in-cart':'')+' availability-'+status+'" data-ingredient="'+esc(i.name)+'"><button class="ingredient-center pantry-item-details" data-pantry-details="'+esc(i.name)+'" aria-label="'+esc(displayName(i.name))+': '+say('részletek és listára vétel','details and shopping list')+'"><span class="ingredient-icon" aria-hidden="true"><img class="product-artwork" src="'+(productArtwork[i.name]||'assets/icons/oats.webp')+'" alt="" draggable="false" width="80" height="80"></span><span class="ingredient-copy"><span class="ingredient-name">'+esc(displayName(i.name))+'</span>'+(basket?'<span class="ingredient-listed"><img src="assets/ui/shopping-cart.svg" alt="" width="13" height="13">'+say('Listán','On list')+'</span>':'')+'</span></button><select class="pantry-availability-select" data-pantry-state="'+esc(i.name)+'" aria-label="'+esc(displayName(i.name))+': '+say('készletállapot','availability')+'">'+(status==='unknown'?'<option value="" selected>'+pantryStateLabel(status)+'</option>':'')+[2,1,0].map(v=>'<option value="'+v+'" '+(WorkspaceEntry.availability(v)===status?'selected':'')+'>'+pantryStateLabel(WorkspaceEntry.availability(v))+'</option>').join('')+'</select></div>';
};
async function updatePantryAvailability(name,value){
 const say=(hu,en)=>language==='en'?en:hu,ctx=voiceContext(),before=state;
 if(household?.busy||household?.cartPending){toast(say('A szinkronizálás még tart. Próbáld újra.','Still syncing. Try again.'));return false}
 if(value===0&&state.stock[name]>0&&window.PantryReview)return PantryReview.remove([name]);
 const next=WorkspaceEntry.availabilityPlan(before,name,value),changes=CompanionModel.changes(before,next);
 if(!await saveVoiceState(next)){toast(say('Nem sikerült menteni. Próbáld újra.','Could not save. Try again.'));return false}
 if(ctx!==voiceContext())return false;
 if(value>0)await window.PantryReview?.confirm([name]);
 if(changes.length)showVoiceUndo(changes,ctx);
 refreshCatalog();toast(displayName(name)+' · '+pantryStateLabel(WorkspaceEntry.availability(value)));return true;
}
function bindAvailability(){
 main.querySelectorAll('[data-pantry-state]').forEach(select=>select.onchange=async()=>{if(select.value==='')return;select.disabled=true;await updatePantryAvailability(select.dataset.pantryState,Number(select.value));if(select.isConnected){select.disabled=false;select.value=String(state.stock[select.dataset.pantryState]??'')}});
 main.querySelectorAll('[data-pantry-details]').forEach(b=>b.onclick=()=>openPantryDetails(b.dataset.pantryDetails));
}
function openPantryDetails(name){
 const say=(hu,en)=>language==='en'?en:hu,ctx=voiceContext();let saving=false,q=document.getElementById('pantry-item-dialog');
 if(!q){q=document.createElement('dialog');q.id='pantry-item-dialog';q.setAttribute('data-no-translate','');document.body.append(q)}
 const paint=()=>{const status=WorkspaceEntry.availability(state.stock[name],Object.hasOwn(state.stock,name)),listed=state.cart.some(i=>i.name===name);
 q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><img class="pantry-detail-art" src="'+(productArtwork[name]||'assets/icons/oats.webp')+'" alt="" width="80" height="80"><h2>'+esc(displayName(name))+'</h2><p>'+say('Mi a helyzet vele otthon?','How much is left at home?')+'</p><div class="pantry-state-options">'+[2,1,0].map(v=>'<button data-value="'+v+'" aria-pressed="'+(WorkspaceEntry.availability(v)===status)+'">'+pantryStateLabel(WorkspaceEntry.availability(v))+'</button>').join('')+'</div><button class="primary full" data-pantry-list><img src="assets/ui/shopping-cart.svg" alt="" width="20" height="20">'+say(listed?'A listán van · eltávolítás':'Bevásárlólistára teszem',listed?'On list · remove':'Add to shopping list')+'</button>'+(listed?'<button class="small-button full" data-pantry-quantity>'+say('Listás mennyiség módosítása','Edit shopping quantity')+'</button>':'');
 q.querySelector('.close').onclick=()=>{if(!saving)q.close()};q.oncancel=e=>{if(saving)e.preventDefault()};
 q.querySelectorAll('[data-value]').forEach(b=>b.onclick=async()=>{if(saving||ctx!==voiceContext())return;saving=true;q.querySelectorAll('button').forEach(b=>b.disabled=true);await updatePantryAvailability(name,Number(b.dataset.value));saving=false;if(q.open&&ctx===voiceContext())paint();else q.close()});
 q.querySelector('[data-pantry-list]').onclick=()=>{if(saving||ctx!==voiceContext())return;saving=true;const before=state,plan=WorkspaceEntry.plan(before,[name],'cart',catalog,productUnit,QuickEntry.norm),next=listed?{...before,cart:before.cart.filter(i=>i.name!==name)}:plan.next;const ok=saveShoppingState(next);saving=false;if(ctx!==voiceContext()){q.close();return}if(!ok){toast(say('Nem sikerült menteni. Próbáld újra.','Could not save. Try again.'));return}if(!listed)basketFeedback();else showVoiceUndo(CompanionModel.changes(before,next),ctx);refreshCatalog();paint()};
 q.querySelector('[data-pantry-quantity]')?.addEventListener('click',()=>{q.close();openQuantity(name,true)});
 };paint();q.showModal();
}
