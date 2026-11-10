// Review metadata tracks confidence in presence, never expiry or food safety.
window.PantryReview=(()=>{
 let checks={},previous={...state.stock},context=null,available=true,loading=false,generation=0,lastRemoval=null;
 const say=(hu,en)=>language==='en'?en:hu,key=()=>JSON.stringify([household?.userId(),household?.active||'local']);
 const due=()=>PantryReviewModel.due(state.stock,context===key()&&available?checks:{},productCategory,nonFoodCategories);
 const snapshot=name=>JSON.stringify([state.stock[name],household?.active?household.rows.find(r=>r.bucket==='stock'&&r.key===name)?.revision:null,checks[name]||null]);
 function mount(){
  main.querySelectorAll('.pantry-maintenance').forEach(e=>e.remove());document.getElementById('pantry-review-entry')?.remove();
  if(!['pantry','overview'].includes(page))return;
  const present=Object.keys(state.stock).filter(n=>state.stock[n]>0);if(!present.length)return;
  const items=context===key()&&available&&!loading?due():[],needs=new Set(items.map(i=>i.name));
  main.querySelectorAll('.ingredient-card').forEach(card=>{card.querySelector('.pantry-confidence')?.remove();const name=card.dataset.ingredient;card.classList.toggle('needs-review',needs.has(name));if(needs.has(name)){const label=document.createElement('small');label.className='pantry-confidence';label.setAttribute('data-no-translate','');label.textContent=say('Megvan még?','Still here?');card.querySelector('.ingredient-copy')?.append(label)}});
  const box=document.createElement('section');box.className='pantry-maintenance'+(items.length?' needs-review':'');box.setAttribute('data-no-translate','');
  box.innerHTML=(items.length?'<div class="maintenance-heading"><span class="maintenance-mark" aria-hidden="true">↻</span><div><strong>'+say('Megvan még otthon?','Still in your pantry?')+'</strong><p>'+items.length+say(' termék vár ellenőrzésre',items.length===1?' product to check':' products to check')+'</p></div><button id="pantry-review-entry">'+say('Átnézem','Review')+' →</button></div>':'')+'<button class="pantry-used-up" data-open-used-up><span aria-hidden="true">−</span>'+say('Mi fogyott el?','What ran out?')+'<small>'+say('Több tétel egyszerre','Remove several items')+'</small></button>';
  if(page==='overview')main.querySelector('#dashboard-review-slot')?.append(box);else main.querySelector('.pantry-heading')?.after(box);
  box.querySelector('#pantry-review-entry')?.addEventListener('click',open);box.querySelector('[data-open-used-up]').onclick=openRemoval;
 }
 async function refresh(){
  const current=key(),token=++generation;if(current!==context){context=current;checks={};available=true;previous={...state.stock};document.getElementById('pantry-review-dialog')?.close();document.getElementById('pantry-remove-dialog')?.close()}
  try{if(!household?.active){checks=JSON.parse(localStorage.getItem('morzsa-pantry-review-local')||'{}');available=true}
   else{loading=true;const rows=await household.readPantryReviews();if(token!==generation||current!==key())return;checks=Object.fromEntries(rows.map(r=>[r.product_name,r]));available=true}
  }catch{if(token===generation&&current===key())available=false}finally{if(token===generation){loading=false;mount()}}
 }
 function onStateChanged(){if(!household?.active){let changed=false;for(const name of new Set([...Object.keys(previous),...Object.keys(state.stock)])){if(state.stock[name]>0&&!previous[name]){checks[name]=new Date().toISOString();changed=true}else if(!(state.stock[name]>0)&&checks[name]){delete checks[name];changed=true}}if(changed)try{localStorage.setItem('morzsa-pantry-review-local',JSON.stringify(checks))}catch{}previous={...state.stock};mount()}}
 async function confirm(names){
  if(!names.length)return true;const current=key();try{if(!household?.active){const next={...checks};for(const name of names)if(state.stock[name]>0)next[name]=new Date().toISOString();localStorage.setItem('morzsa-pantry-review-local',JSON.stringify(next));checks=next}
   else{await household.confirmPantryReviews(names);if(current!==key())return false;await refresh()}mount();return true;
  }catch{toast(say('Az ellenőrzést nem sikerült menteni.','Could not save the check.'));return false}
 }
 async function remove(names,alsoList=false,expected=null){
  if(household?.busy||household?.cartPending){toast(say('A szinkronizálás még tart. Próbáld újra.','Still syncing. Please try again.'));return false}
  if(expected&&names.some(n=>expected.get(n)!==snapshot(n))){toast(say('Közben változott a készlet. Ellenőrizd újra a kijelölést.','The pantry changed. Review your selection again.'));return false}
  const current=key(),undoContext=voiceContext(),plan=PantryReviewModel.removalPlan(state,names,alsoList,productUnit);
  if(!plan.changes.length)return true;
  const ok=await saveVoiceState(plan.next);if(current!==key())return false;if(!ok)return false;
  lastRemoval={changes:plan.changes,context:current};homeUndo.length=0;onStateChanged();await refresh();render();showVoiceUndo(plan.changes,undoContext);
  const notice=document.querySelector('#voice-undo>span');if(notice)notice.textContent=names.filter(n=>plan.changes.some(c=>c.bucket==='stock'&&c.key===n)).length+say(' tétel lekerült a készletből',' items removed from pantry');return true;
 }
 function openRemoval(){
  if(household?.busy||household?.cartPending)return;
  let q=document.getElementById('pantry-remove-dialog');if(!q){q=document.createElement('dialog');q.id='pantry-remove-dialog';q.setAttribute('data-no-translate','');document.body.append(q)}
  const current=key(),selected=new Map();let saving=false;
  q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><h2>'+say('Mi fogyott el?','What ran out?')+'</h2><p class="removal-caption">'+say('Jelöld be, ami már nincs otthon.','Select what you no longer have at home.')+'</p><input id="removal-search" type="search" placeholder="'+say('Keresés a készletben…','Search your pantry…')+'" aria-label="'+say('Keresés a készletben','Search your pantry')+'"><div class="removal-items"></div><div class="removal-footer"><label><input id="removal-list" type="checkbox">'+say('A bevásárlólistára is','Also add to shopping list')+'</label><button id="removal-apply" class="primary" disabled>'+say('Elfogyott','Used up')+'</button><p class="removal-error" role="status"></p></div>';
  q.querySelector('.close').onclick=()=>{if(!saving)q.close()};q.oncancel=e=>{if(saving)e.preventDefault()};
  function paint(){const query=QuickEntry.norm(q.querySelector('#removal-search').value),names=Object.keys(state.stock).filter(n=>state.stock[n]>0).sort((a,b)=>compareProducts({name:a},{name:b})).filter(n=>!query||QuickEntry.norm(n).includes(query)||QuickEntry.norm(productEnglish[n]||'').includes(query));
   q.querySelector('.removal-items').innerHTML=names.length?names.map(n=>'<label class="removal-row"><input type="checkbox" data-remove-name="'+esc(n)+'" '+(selected.has(n)?'checked':'')+'><img src="'+(productArtwork[n]||'assets/icons/oats.webp')+'" alt="" width="38" height="38"><span>'+esc(displayName(n))+'</span></label>').join(''):'<p>'+say('Nincs találat.','No matches.')+'</p>';
   q.querySelectorAll('[data-remove-name]').forEach(input=>input.onchange=()=>{if(input.checked)selected.set(input.dataset.removeName,snapshot(input.dataset.removeName));else selected.delete(input.dataset.removeName);update()});update();
  }
  function update(){const b=q.querySelector('#removal-apply');b.disabled=!selected.size||saving;b.textContent=saving?say('Mentés…','Saving…'):say('Elfogyott','Used up')+(selected.size?' · '+selected.size:'')}
  q.querySelector('#removal-search').oninput=paint;
  q.querySelector('#removal-apply').onclick=async()=>{if(saving||current!==key()||!selected.size)return;saving=true;update();q.querySelectorAll('input,button').forEach(e=>e.disabled=true);const ok=await remove([...selected.keys()],q.querySelector('#removal-list').checked,selected);saving=false;if(current!==key()){q.close();return}if(ok)q.close();else{selected.clear();q.querySelectorAll('input,button').forEach(e=>e.disabled=false);paint();q.querySelector('.removal-error').textContent=say('Nem mentettünk. Jelöld ki újra a tételeket.','Not saved. Select the items again.')}};
  paint();q.showModal();
 }
 async function open(){
  if(loading||household?.busy||household?.cartPending)return;
  let q=document.getElementById('pantry-review-dialog');if(!q){q=document.createElement('dialog');q.id='pantry-review-dialog';q.setAttribute('data-no-translate','');document.body.append(q)}
  const current=key(),batch=due().slice(0,5);let at=0,busy=false,undoStep=null;
  const paint=()=>{
   if(current!==key()){q.close();return}if(at>=batch.length){q.close();mount();toast(say('Áttekintés kész.','Review complete.'));return}
   const item=batch[at];if(!(state.stock[item.name]>0)){at++;paint();return}const expected=new Map([[item.name,snapshot(item.name)]]);
   q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><div class="eyebrow">'+(at+1)+' / '+batch.length+'</div><h2>'+say('Van még otthon?','Still at home?')+'</h2><div class="review-product"><img src="'+(productArtwork[item.name]||'assets/icons/oats.webp')+'" alt="" width="64" height="64"><strong>'+esc(displayName(item.name))+'</strong></div><p class="helper">'+(item.unknown?say('Ezt még nem ellenőriztük.','This has not been checked yet.'):say('Egy ideje nem erősítettétek meg.','It has been a while since you checked.'))+'</p><div class="review-choices"><button class="primary" data-review="gone">'+say('Elfogyott','Used up')+'</button><button class="small-button" data-review="list">'+say('Elfogyott, listára','Used up — add to list')+'</button><button class="small-button" data-review="keep">'+say('Van még','Still have it')+'</button></div><button class="small-button review-skip" data-review="skip">'+say('Most kihagyom','Skip for now')+'</button>'+(undoStep?'<button class="small-button review-undo" id="review-undo">'+say('Visszavonom a kivételt','Undo removal')+'</button>':'')+'<p class="review-error" role="status"></p>';
   q.querySelector('.close').onclick=()=>{if(!busy)q.close()};q.oncancel=e=>{if(busy)e.preventDefault()};
   q.querySelector('#review-undo')?.addEventListener('click',async()=>{
    if(busy||current!==key()||household?.busy||household?.cartPending||!undoStep)return;
    busy=true;q.querySelectorAll('button').forEach(b=>b.disabled=true);const result=VoiceModel.undo(state,undoStep.removal.changes),ok=await saveVoiceState(result.next);busy=false;
    if(current!==key()){q.close();return}if(ok){at=undoStep.index;undoStep=null;clearInterval(voiceUndoTimer);document.getElementById('voice-undo')?.remove();onStateChanged();await refresh();render();paint();if(result.skipped)toast(say('A közben módosított tételeket megtartottuk.','Items changed since then were kept.'))}else{paint();q.querySelector('.review-error').textContent=say('Nem sikerült visszavonni.','Could not undo.')}
   });
   q.querySelectorAll('[data-review]').forEach(button=>button.onclick=async()=>{
    if(busy||current!==key()||household?.busy||household?.cartPending)return;const action=button.dataset.review;if(action==='skip'){at++;paint();return}
    busy=true;q.querySelectorAll('button').forEach(b=>b.disabled=true);let ok=false;
    try{ok=action==='keep'?await confirm([item.name]):await remove([item.name],action==='list',expected)}catch{ok=false}finally{busy=false}
    if(!q.open)return;if(ok){if(action!=='keep')undoStep={index:at,removal:lastRemoval};at++;paint();if(page==='pantry')renderPantry();else if(page==='overview')renderDashboard()}else{paint();q.querySelector('.review-error').textContent=say('Nem sikerült menteni. Ellenőrizd, és próbáld újra.','Not saved. Check and try again.')}
   });
  };paint();if(at<batch.length)q.showModal();
 }
 const original=renderPantry;renderPantry=function(){original();mount()};
 refresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 return {refresh,confirm,onStateChanged,mount,remove,openRemoval,open,uncertain:()=>due().map(x=>x.name)};
})();
