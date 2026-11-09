// Optional review metadata. Numeric stock values and existing save formats remain unchanged.
window.PantryReview=(()=>{
 let checks={},previous={...state.stock},context=null,available=true,loading=false,generation=0;
 const say=(hu,en)=>language==='en'?en:hu,key=()=>window.household?.active||'local';
 const due=()=>PantryReviewModel.due(state.stock,context===key()&&available?checks:{},productCategory,nonFoodCategories);
 function mount(){
  document.getElementById('pantry-review-entry')?.remove();if(context!==key()||page!=='pantry'||!available||!due().length)return;
  const button=document.createElement('button');button.id='pantry-review-entry';button.className='pantry-review-entry';button.setAttribute('data-no-translate','');button.textContent=say('Érdemes ránézni · ','Worth a quick check · ')+due().length;button.onclick=open;
  (main.querySelector('.pantry-heading')||main.firstElementChild)?.after(button);
 }
 async function refresh(){
  const current=key(),token=++generation;if(current!==context){context=current;checks={};available=true;previous={...state.stock}}
  try{if(current==='local'){checks=JSON.parse(localStorage.getItem('morzsa-pantry-review-local')||'{}');available=true}
   else{loading=true;const rows=await household.readPantryReviews();if(token!==generation||current!==key())return;checks=Object.fromEntries(rows.map(r=>[r.product_name,r]));available=true}
  }catch{if(token===generation&&current===key())available=false}finally{if(token===generation){loading=false;mount()}}
 }
 function onStateChanged(){if(key()==='local'){let changed=false;for(const name of new Set([...Object.keys(previous),...Object.keys(state.stock)])){if(state.stock[name]>0&&!previous[name]){checks[name]=new Date().toISOString();changed=true}else if(!(state.stock[name]>0)&&checks[name]){delete checks[name];changed=true}}if(changed)try{localStorage.setItem('morzsa-pantry-review-local',JSON.stringify(checks))}catch{}previous={...state.stock};mount()}}
 async function confirm(names){
  if(!names.length)return true;const current=key();try{if(current==='local'){const next={...checks};for(const name of names)if(state.stock[name]>0)next[name]=new Date().toISOString();localStorage.setItem('morzsa-pantry-review-local',JSON.stringify(next));checks=next}
   else{await household.confirmPantryReviews(names);if(current!==key())return false;await refresh()}
   mount();return true;
  }catch{toast(say('Az ellenőrzést nem sikerült menteni.','Could not save the check.'));return false}
 }
 async function open(){
  if(loading||household?.busy||household?.cartPending)return;
  let q=document.getElementById('pantry-review-dialog');if(!q){q=document.createElement('dialog');q.id='pantry-review-dialog';q.setAttribute('data-no-translate','');document.body.append(q)}
  const current=key(),batch=due().slice(0,5);let at=0,busy=false;
  const paint=()=>{
   if(current!==key()){q.close();return}
   if(at>=batch.length){q.close();mount();toast(say('Áttekintés kész.','Review complete.'));return}
   const item=batch[at];if(!(state.stock[item.name]>0)){at++;paint();return}
   q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><div class="eyebrow">'+(at+1)+' / '+batch.length+'</div><h2>'+say('Van még otthon?','Still at home?')+'</h2><div class="review-product"><img src="'+esc(productArtwork[item.name]||'assets/icons/oats.webp')+'" alt="" width="64" height="64"><strong>'+esc(displayName(item.name))+'</strong></div><p class="helper">'+(item.unknown?say('Ezt még nem ellenőriztük.','This has not been checked yet.'):say('Egy ideje nem erősítettétek meg.','It has been a while since you checked.'))+'</p><div class="review-choices"><button class="primary" data-review="keep">'+say('Van még','Still have it')+'</button><button class="small-button" data-review="gone">'+say('Elfogyott','Used up')+'</button><button class="small-button" data-review="list">'+say('Elfogyott, listára','Used up — add to list')+'</button></div><button class="small-button review-skip" data-review="skip">'+say('Most kihagyom','Skip for now')+'</button><p class="review-error" role="status"></p>';
   q.querySelector('.close').onclick=()=>{if(!busy)q.close()};q.oncancel=e=>{if(busy)e.preventDefault()};
   q.querySelectorAll('[data-review]').forEach(button=>button.onclick=async()=>{
    if(busy||current!==key()||household?.busy||household?.cartPending)return;const action=button.dataset.review;if(action==='skip'){at++;paint();return}
    busy=true;q.querySelectorAll('button').forEach(b=>b.disabled=true);let ok=false;
    try{if(action==='keep')ok=await confirm([item.name]);else{
     const next={...state,stock:{...state.stock,[item.name]:0},cart:state.cart.map(x=>({...x}))};
     if(action==='list'){const found=next.cart.find(x=>x.name===item.name);if(found)found.done=false;else next.cart.push({name:item.name,quantity:1,unit:productUnit(item.name),done:false,source:'Készletellenőrzés'})}
     if(household?.active){state=next;ok=!!await household.notify()}else ok=commitState(next);
     if(ok){onStateChanged();await refresh()}
    }}catch{ok=false}finally{busy=false}
    if(!q.open)return;if(ok){at++;paint();if(page==='pantry')renderPantry()}else{q.querySelectorAll('button').forEach(b=>b.disabled=false);q.querySelector('.review-error').textContent=say('Nem sikerült menteni. Próbáld újra.','Could not save. Try again.')}
   });
  };paint();if(at<batch.length)q.showModal();
 }
 const original=renderPantry;renderPantry=function(){original();mount()};
 refresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 return {refresh,confirm,onStateChanged,mount,uncertain:()=>due().map(x=>x.name)};
})();
