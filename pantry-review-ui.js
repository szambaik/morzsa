// Review metadata tracks confidence in presence, never expiry or food safety.
window.PantryReview=(()=>{
 let checks={},previous={...state.stock},context=null,available=true,loading=false,generation=0,lastRemoval=null;
 const say=(hu,en)=>language==='en'?en:hu,key=()=>JSON.stringify([household?.userId(),household?.active||'local']);
 const due=()=>PantryReviewModel.due(state.stock,context===key()&&available?checks:{},productCategory,nonFoodCategories,Date.now(),n=>householdPriority.get(n)??9999);
 const snapshot=name=>JSON.stringify([state.stock[name],household?.active?household.rows.find(r=>r.bucket==='stock'&&r.key===name)?.revision:null,checks[name]||null]);
 function mount(){
  main.querySelectorAll('.pantry-maintenance').forEach(e=>e.remove());document.getElementById('pantry-review-entry')?.remove();
  window.MorzsaCompanion?.updateNudge();if(!['pantry','overview'].includes(page))return;
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
 async function confirm(names,expected=null){
  if(expected&&names.some(n=>expected.get(n)!==snapshot(n))){toast(say('Közben változott egy tétel. Nyisd meg újra az ellenőrzést.','An item changed. Reopen the review.'));return false}
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
  lastRemoval={changes:plan.changes,context:current};window.MorzsaCompanion?.removed(names);homeUndo.length=0;onStateChanged();await refresh();render();showVoiceUndo(plan.changes,undoContext);
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
 function open(options={}){
  if(loading||household?.busy||household?.cartPending)return;
  const inline=!!options.host;let q=inline?document.createElement('section'):document.getElementById('pantry-review-dialog');if(!q){q=document.createElement('dialog');q.id='pantry-review-dialog';q.setAttribute('data-no-translate','');document.body.append(q)}
  if(inline){q.className='inline-pantry-review';q.setAttribute('data-inline-review','');options.host.replaceChildren(q)}
  const close=()=>{if(inline){q.remove();options.onClose?.()}else q.close()};
  const current=key(),batch=options.items||due().slice(0,8),choices=new Map(),expected=new Map(batch.map(i=>[i.name,snapshot(i.name)]));let saving=false;
  if(!batch.length){toast(say('Most minden frissen ellenőrzött.','Everything is up to date.'));return}
  q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><h2>'+say('Megvan még?','Still at home?')+'</h2><p class="review-batch-caption">'+say('Régebben ellenőrzött, gyakran fogyó alapanyagok. Amit nem jelölsz, marad úgy, ahogy van.','Older checks and frequently used basics. Unselected items stay unchanged.')+'</p><button class="small-button" data-review-all>'+say('Mind megvan','All still here')+'</button><div class="review-batch-items">'+batch.map((item,i)=>'<div class="review-batch-row"><img src="'+(productArtwork[item.name]||'assets/icons/oats.webp')+'" alt="" width="34" height="34"><div><strong>'+esc(displayName(item.name))+'</strong><small>'+(item.unknown?say('Még nem ellenőrzött','Not checked yet'):Math.floor(item.age)+say(' napja ellenőrizve',' days since check'))+'</small></div><div class="review-batch-options"><button data-choice="keep" data-index="'+i+'" aria-pressed="false" aria-label="'+esc(displayName(item.name))+say(': van még',': still here')+'">'+say('Van még','Still here')+'</button><button data-choice="gone" data-index="'+i+'" aria-pressed="false" aria-label="'+esc(displayName(item.name))+say(': elfogyott',': used up')+'">'+say('Elfogyott','Used up')+'</button></div></div>').join('')+'</div><div class="review-batch-footer"><label><input type="checkbox" data-review-list> '+say('Az elfogyottakat a listára is','Also list used-up items')+'</label><button class="primary" data-review-save disabled>'+say('Mentés','Save')+'</button><p class="review-error" role="status"></p></div>';
  if(inline){q.querySelector('.review-batch-caption').textContent=say('Jelöld, ami megvan vagy elfogyott.','Mark what is still here or used up.');q.querySelectorAll('.review-batch-row small').forEach(e=>e.remove())}
  const update=()=>{q.querySelectorAll('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',choices.get(batch[Number(b.dataset.index)].name)===b.dataset.choice));const b=q.querySelector('[data-review-save]');b.disabled=saving||!choices.size;b.textContent=saving?say('Mentés…','Saving…'):say('Mentés','Save')+' · '+choices.size};
  q.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{const name=batch[Number(b.dataset.index)].name;if(choices.get(name)===b.dataset.choice)choices.delete(name);else choices.set(name,b.dataset.choice);update()});
  q.querySelector('[data-review-all]').onclick=()=>{batch.forEach(i=>choices.set(i.name,'keep'));update()};
  q.querySelector('.close').onclick=()=>{if(!saving)close()};q.oncancel=e=>{if(saving)e.preventDefault()};
  q.querySelector('[data-review-save]').onclick=async()=>{
   if(saving||current!==key()||!choices.size||household?.busy||household?.cartPending)return;
   const names=[...choices.keys()];if(names.some(n=>expected.get(n)!==snapshot(n))){q.querySelector('.review-error').textContent=say('Közben változott egy kijelölt tétel. Zárd be, és nyisd meg újra az ellenőrzést.','A selected item changed. Close and reopen this review.');return}
   const keep=names.filter(n=>choices.get(n)==='keep'),gone=names.filter(n=>choices.get(n)==='gone'),alsoList=q.querySelector('[data-review-list]').checked;
   saving=true;update();q.querySelectorAll('button,input').forEach(b=>b.disabled=true);let kept=false,ok=false;
   try{kept=await confirm(keep,expected);if(kept&&current===key()){keep.forEach(n=>choices.delete(n));ok=gone.length?await remove(gone,alsoList,expected):true}}catch{ok=false}
   saving=false;if(current!==key()){close();return}if(ok){close();mount();if(!gone.length)toast(keep.length+say(' termék megerősítve.',' products confirmed.'))}
   else{q.querySelectorAll('button,input').forEach(b=>b.disabled=false);update();q.querySelector('.review-error').textContent=kept&&keep.length?say('A megmaradt termékeket megerősítettük. A kivétel nem sikerült; ellenőrizd újra.','Available items confirmed. Removal failed; review again.'):say('Nem sikerült menteni. Próbáld újra.','Could not save. Try again.')}
  };
  if(!inline)q.showModal();
 }
 const original=renderPantry;renderPantry=function(){original();mount()};
 refresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 return {refresh,confirm,onStateChanged,mount,remove,openRemoval,open,candidates:()=>context===key()&&available&&!loading?due():[],uncertain:()=>due().map(x=>x.name)};
})();
