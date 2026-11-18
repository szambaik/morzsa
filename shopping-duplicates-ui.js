// Explicit cleanup only; loading an older save or joining a household never
// rewrites ingredient keys. Failed/stale previews can be reviewed again.
window.ShoppingDuplicates=(()=>{
 const say=(hu,en)=>language==='en'?en:hu;
 const scope=()=>[household?.active||'',household?.userId()||''].join(':');
 const revisions=plan=>plan.changes.map(c=>household?.rows.find(r=>r.bucket===c.bucket&&r.key===c.key)?.revision||0);
 function mount(){
  if(!['pantry','shopping'].includes(page))return;
  const bucket=page==='pantry'?'stock':'cart',groups=productIdentity.duplicates(state,bucket),old=main.querySelector('.shopping-duplicates');old?.remove();
  if(!groups.length)return;
  const host=document.createElement('aside');host.className='shopping-duplicates';host.setAttribute('data-no-translate','');
  host.innerHTML='<p>'+groups.length+say(' alapanyag több néven szerepel.',' ingredients appear under multiple names.')+'</p><button type="button">'+say('Megnézem az összevonást','Review duplicates')+'</button>';
  (main.querySelector('.shopping-price-summary')||main.querySelector('.shopping-mode-top')||main.querySelector('.pantry-heading'))?.after(host);
  host.querySelector('button').onclick=()=>preview(bucket);
 }
 function preview(bucket){
  let q=document.getElementById('shopping-merge-dialog');if(!q){q=document.createElement('dialog');q.id='shopping-merge-dialog';q.setAttribute('data-no-translate','');document.body.append(q)}
  const context=scope(),opener=document.activeElement;let plan,expected,busy=false;
  q.onclose=()=>{if(scope()!==context||document.querySelector('dialog[open]'))return;const target=opener?.isConnected?opener:main.querySelector('.shopping-duplicates button,[data-quantity-toggle],[data-pantry-details]');target?.focus({preventScroll:true})};
  q.setAttribute('aria-labelledby','shopping-merge-title');
  const resultValue=group=>bucket==='stock'?pantryStateLabel(WorkspaceEntry.availability(group.value)):cartAmount(group.value);
  function paint(){
   plan=productIdentity.consolidate(state,bucket,{unitFor:productUnit});expected=revisions(plan);
   q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><h2 id="shopping-merge-title">'+say('Azonos alapanyagok','Same ingredients')+'</h2><p>'+say(bucket==='stock'?'A készletnél a meglévő legerősebb „van otthon” jelzést tartjuk meg.':'A listán az összeadható mennyiségeket összegezzük. Az eredeti hozzáadások forrását megőrizzük.',bucket==='stock'?'The pantry keeps the strongest existing availability.':'Compatible shopping quantities are added together. Original addition sources are retained.')+'</p>'+plan.merged.map(group=>'<div class="shopping-merge-preview"><strong>'+esc(group.rows.map(r=>displayName(r.name)).join(' + '))+'</strong><small>→ '+esc(displayName(group.name))+' · '+esc(resultValue(group))+'</small></div>').join('')+(plan.skipped.length?'<p>'+say('Ezek külön maradnak, mert eltér az egység, a megjegyzés, a receptkapcsolat vagy a vásárlási állapot: ','These stay separate because their units, notes, recipe links or purchase state differ: ')+esc(plan.skipped.map(g=>g.rows.map(r=>displayName(r.name)).join(' / ')).join('; '))+'</p>':'')+'<p role="status" data-merge-status></p>'+(plan.merged.length?'<button class="primary full" data-merge-confirm>'+say('Összevonom','Merge ingredients')+'</button>':'')+'<button class="small-button full" data-merge-cancel>'+say('Mégsem','Cancel')+'</button>';
   q.querySelector('.close').onclick=()=>q.close();q.querySelector('[data-merge-cancel]').onclick=()=>q.close();q.querySelector('[data-merge-confirm]')?.addEventListener('click',()=>save(plan,expected));
  }
  async function save(request,guards,isUndo=false){
   if(busy||scope()!==context)return;busy=true;q.querySelectorAll('button:not(.close)').forEach(b=>b.disabled=true);q.querySelector('[data-merge-status]').textContent=say('Mentés…','Saving…');
   let result;
   try{
    if(household?.active)result=await household.consolidateIngredients(request,guards);
    else{const next=productIdentity.apply(state,request);result={status:!next?'stale':commitState(next)?'saved':'failed'};if(result.status==='saved'){if(page==='pantry')refreshCatalog();else refreshShoppingRows()}}
   }catch{result={status:'failed'}}finally{busy=false}
   if(scope()!==context)return;
   if(!q.open){toast(say(result.status==='saved'?(isUndo?'Összevonás visszavonva.':'Az alapanyagokat összevontuk.'):'Az összevonás nem sikerült. Nézd át újra a friss adatokat.',result.status==='saved'?(isUndo?'Merge undone.':'Ingredients merged.'):'Merge failed. Review the latest data.'));return}
   const status=q.querySelector('[data-merge-status]');
   if(result.status!=='saved'){
    status.textContent=say(result.status==='stale'?'A tételek közben módosultak. Nézd át újra a friss adatokat.':result.status==='busy'?'Még tart a szinkronizálás. Próbáld újra.':'Nem sikerült menteni. Ellenőrizd a kapcsolatot, majd nézd át újra.',result.status==='stale'?'Items changed. Review the latest data.':result.status==='busy'?'Still syncing. Try again.':'Could not save. Check your connection and review again.');
    q.querySelectorAll('[data-merge-confirm],[data-merge-undo]').forEach(b=>b.remove());const retry=document.createElement('button');retry.className='primary full';retry.textContent=say('Friss adatok áttekintése','Review latest data');retry.onclick=paint;status.after(retry);q.querySelector('[data-merge-cancel]').disabled=false;return;
   }
   status.textContent=say(isUndo?'Összevonás visszavonva.':'Az alapanyagokat összevontuk.',isUndo?'Merge undone.':'Ingredients merged.');
   q.querySelectorAll('[data-merge-confirm],[data-merge-undo]').forEach(b=>b.remove());const close=q.querySelector('[data-merge-cancel]');close.disabled=false;close.textContent=say('Kész','Done');
   if(!isUndo){const reverse={bucket,changes:request.changes.map(c=>({...c,before:c.after,after:c.before})),merged:[],skipped:[]},undo=document.createElement('button');undo.className='small-button full';undo.dataset.mergeUndo='';undo.textContent=say('Visszavonás','Undo');const freshGuards=revisions(reverse);undo.onclick=()=>save(reverse,freshGuards,true);status.after(undo)}
  }
  paint();q.showModal();
 }
 return {mount};
})();
