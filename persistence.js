window.MorzsaPersistence=(()=>{
 const M=PersistenceModel,read=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}},say=(hu,en)=>language==='en'?en:hu;
 let refreshDeferred=false,lastIndexRefresh=0,turnPageSupported=null;
 let user='',book=null,callbacks={},epoch=0,ready=false,running=false,refreshing=false,queue={},timer,refreshTimer,live,issue='',indexPages=1,more=false;
 const signedPhotos=new Map(),knownMeta=new Map(),knownMessages=new Map(),recipeIds=new Map(),media=new Map(),turnAccounts=new Map();
 const valid=()=>user&&user===household?.userId();
 const same=(account,generation)=>valid()&&account===user&&generation===epoch;
 function guard(account,generation){if(!same(account,generation))throw Error('Account changed')}
 const outboxKey=()=>M.accountKey(user)+':outbox';
 function saveQueue(){localStorage.setItem(outboxKey(),JSON.stringify(queue))}
 function status(){callbacks.status?.(issue||(!ready?'loading':Object.keys(queue).length?'pending':'synced'))}
 function changed(){const next=callbacks.changed?.(book);if(next)book=next;status()}
 const rpc=(name,args,expected=user)=>household.dataRpc(name,args,true,expected);
 async function stableId(text){const d=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');return d.slice(0,8)+'-'+d.slice(8,12)+'-5'+d.slice(13,16)+'-a'+d.slice(17,20)+'-'+d.slice(20,32)}
 async function importOld(){
  const current=user,idEpoch=epoch,threads=new Map(book.threads.map(t=>[t.id,t]));
  const keys=Object.keys(localStorage).filter(k=>/^morzsa-companion-v[1-4]:/.test(k)).sort().reverse(),sources=new Set();
  for(const key of keys){let parts;try{parts=JSON.parse(key.slice(key.indexOf(':')+1))}catch{continue}if(parts[0]!==current)continue;
   const source=JSON.stringify(parts);if(sources.has(source))continue;sources.add(source);
   const old=read(key);if(!Array.isArray(old?.threads))continue;
   const ids=new Map();for(const t of old.threads){ids.set(t.id,await stableId(current+'|'+source+'|'+t.id));guard(current,idEpoch)}
   for(const oldThread of old.threads){const id=ids.get(oldThread.id);if(threads.has(id))continue;const t=structuredClone(oldThread);t.id=id;t.language=parts[2];t.parentId=ids.get(t.parentId);for(let i=0;i<(t.messages||[]).length;i++){const m=t.messages[i];m.id=await stableId(id+'|'+i+'|'+(m.createdAt||0)+'|'+m.role+'|'+m.text);guard(current,idEpoch);if(m.photo)media.set(m.id,{data:m.photo.split(',')[1]})}threads.set(id,t)}
  }
  if(current!==user||idEpoch!==epoch)return;
  book.threads=[...threads.values()];capture(book);changed();
 }
 function attach(value,handlers){
  callbacks=handlers;const next=household?.userId();if(!M.uuid(next)||!household?.dataRpc)return false;
  if(next===user){book=value;return true}
  live?.close();clearTimeout(timer);clearTimeout(refreshTimer);refreshDeferred=false;lastIndexRefresh=0;user=next;epoch++;ready=false;running=false;refreshing=false;issue='';indexPages=1;knownMeta.clear();knownMessages.clear();recipeIds.clear();media.clear();signedPhotos.clear();book=value;queue=read(outboxKey())||{};
  const current=user,generation=epoch;refresh(true).then(()=>{guard(current,generation);return importOld()}).then(()=>{guard(current,generation);return flush(current,generation)}).catch(()=>{if(same(current,generation)){issue='failed';status()}});
  live=household.subscribeData?.(()=>scheduleRefresh());status();return true;
 }
 function detach(){live?.close();clearTimeout(timer);clearTimeout(refreshTimer);refreshDeferred=false;lastIndexRefresh=0;user='';epoch++;book=null;queue={};ready=false;running=false;refreshing=false;status()}
 function capture(value){
  if(!valid())return;book=value;book.cloud=true;
  for(const t of value.threads){if(t.readOnly||!ready&&!t.revision&&!t.messages.length&&!t.recipe)continue;if(!M.uuid(t.id))t.id=crypto.randomUUID();for(const m of t.messages||[])if(!M.uuid(m.id))m.id=crypto.randomUUID();
   if(t.kind==='recipe'&&t.recipe&&!Object.hasOwn(t,'recipeHousehold')&&M.uuid(t.sharedHousehold||household?.active))t.recipeHousehold=t.sharedHousehold||household.active;const meta=M.metadata(t),items=t.messages.map(M.message),dirty=items.filter(m=>knownMessages.get(m.id)!==JSON.stringify(m));
   if(JSON.stringify(meta)!==knownMeta.get(t.id)||dirty.length)queue[t.id]={meta,base:queue[t.id]?.base||(knownMeta.has(t.id)?JSON.parse(knownMeta.get(t.id)):null),items:dirty,revision:t.revision||0,photos:Object.fromEntries(t.messages.filter(m=>m.photo&&!m.photoPath).map(m=>[m.id,media.get(m.id)||{data:m.photo.split(',')[1]}]))};
  }
  try{saveQueue()}catch{issue='storage';status();return}clearTimeout(timer);timer=setTimeout(flush,250);status();
 }
 async function ensureRecipe(recipe,current=user,generation=epoch){
  guard(current,generation);
  if(!valid())throw Error('Sign in required');const clean=RecipeRoomModel.recipe(recipe);if(!clean)throw Error('Invalid recipe');
  if(M.uuid(clean.recipeId))return clean;
  const key=RecipeRoomModel.identity(clean);if(recipeIds.has(key)){const id=await recipeIds.get(key);guard(current,generation);return {...clean,recipeId:id}};
  const promise=rpc('save_recipe_document',{rid:crypto.randomUUID(),recipe:clean},current);recipeIds.set(key,promise);
  try{const id=await promise;if(current!==user||generation!==epoch)throw Error('Account changed');return {...clean,recipeId:id}}catch(e){if(recipeIds.get(key)===promise)recipeIds.delete(key);throw e}
 }
 async function flush(current=user,generation=epoch){
  if(!same(current,generation))return;
  if(running){await new Promise(resolve=>setTimeout(resolve,100));return flush(current,generation)}
  if(!ready||!Object.keys(queue).length)return;running=true;const run=async(name,args)=>{guard(current,generation);const result=await rpc(name,args,current);guard(current,generation);return result};
  try{
   for(const [id,original] of Object.entries(queue)){
    if(!valid()||current!==user||generation!==epoch)return;const job=structuredClone(original),refs=new Set();
    if(job.meta.recipe){job.meta.recipe=await ensureRecipe(job.meta.recipe,current,generation);refs.add(job.meta.recipe.recipeId)}
    for(const m of job.items){m.recipes=await Promise.all((m.recipes||[]).map(r=>ensureRecipe(r,current,generation)));m.recipes.forEach(r=>refs.add(r.recipeId))}
    let result;
    for(let n=0;n<Math.max(1,job.items.length);n+=50){const args={cid:id,meta:job.meta,expected:job.revision,items:job.items.slice(n,n+50),recipe_ids:[...refs]};
     try{result=await run('sync_conversation',args)}catch(e){if(!/Conflict/.test(e.message||''))throw e;const rows=await run('conversation_index',{page_offset:0}),row=rows.find(r=>r.id===id);if(!row?.owner)throw e;job.meta=M.mergeMetadata(row.metadata,job.meta,job.base);job.revision=row.revision;args.meta=job.meta;args.expected=job.revision;result=await run('sync_conversation',args)}job.revision=result.revision;
    }
    // Upload photos after the owner conversation exists. A retry reuses its path.
    for(const m of job.items){const photo=job.photos?.[m.id]||media.get(m.id);if(!photo)continue;const path=current+'/'+id+'/'+m.id+'.jpg';const bytes=Uint8Array.from(atob(photo.data),c=>c.charCodeAt(0));
     try{guard(current,generation);await household.mediaUpload(path,bytes,current);guard(current,generation)}catch(e){if(!/already exists|Duplicate|409/i.test(e.message||''))throw e}m.photoPath=path;media.delete(m.id);
     result=await run('sync_conversation',{cid:id,meta:job.meta,expected:job.revision,items:[m],recipe_ids:[...refs]});job.revision=result.revision;
    }
    if(current!==user||generation!==epoch)return;
    if(job.meta.kind==='recipe'&&M.uuid(job.meta.recipeHousehold)&&book.threads.find(t=>t.id===id)?.sharedHousehold!==job.meta.recipeHousehold){try{await run('share_household_recipe_conversation',{hid:job.meta.recipeHousehold,cid:id})}catch(e){if(!/Could not find.*share_household_recipe_conversation|function.*share_household_recipe_conversation.*does not exist/i.test(e.message||''))throw e;await run('share_conversation',{hid:job.meta.recipeHousehold,cid:id})}const t=book.threads.find(t=>t.id===id);if(t)t.sharedHousehold=job.meta.recipeHousehold}knownMeta.set(id,JSON.stringify(job.meta));job.items.forEach(m=>knownMessages.set(m.id,JSON.stringify(m)));
    const t=book.threads.find(t=>t.id===id);if(t){t.revision=job.revision;if(t.recipe&&job.meta.recipe)t.recipe=job.meta.recipe;for(const m of t.messages){const saved=job.items.find(i=>i.id===m.id);if(saved){m.recipes=saved.recipes;if(saved.photoPath)m.photoPath=saved.photoPath}}}
    if(queue[id]===original)delete queue[id];else if(queue[id]){queue[id].base=job.meta;queue[id].revision=job.revision}saveQueue();
   }
   issue='';callbacks.saved?.();status();window.KitchenIntelligence?.refresh();await refresh();
  }catch(e){if(current===user&&generation===epoch){issue=/denied/i.test(e.message||'')?'access':'failed';status()}}
  finally{if(current===user&&generation===epoch){running=false;if(!issue&&Object.keys(queue).length)timer=setTimeout(flush,500)}}
 }
 async function loadThread(id,older=false,force=false,providedPage=null,hydratePhotos=true){
  if(!valid())return;const generation=epoch,current=user,t=book.threads.find(t=>t.id===id);if(!t||!t.revision&&!force)return;
  const result=providedPage||await rpc('conversation_page',{cid:id,before_seq:older?t.before:null});if(!same(current,generation)||book.threads.find(x=>x.id===id)!==t||!force&&callbacks.safe?.()===false)return;
  const previous=JSON.stringify(t);const msgs=result.messages.map(r=>({...r.body,id:r.id,sequence:r.sequence}));msgs.forEach(m=>knownMessages.set(m.id,JSON.stringify(M.message(m))));
  t.messages=M.mergeMessages(msgs,t.messages||[],queue[id]?.items||[]);t.loaded=true;if(older||!t.before){t.before=result.before;t.hasOlder=result.hasOlder}
  // Historical photo URLs are presentation work; turn preflight needs only text.
  // The next ordinary refresh hydrates them with the usual account guards.
  for(const m of msgs)if(m.photoPath)try{let signed=signedPhotos.get(m.photoPath);if(!signed||signed.expires<Date.now()){if(!hydratePhotos)continue;signed={...await household.mediaSign(m.photoPath,current),expires:Date.now()+1700000};signedPhotos.set(m.photoPath,signed)}if(!same(current,generation))return;const local=t.messages.find(i=>i.id===m.id);if(local)local.photo=window.MORZSA_CLOUD.url+'/storage/v1'+signed.signedURL}catch{}
  if(previous!==JSON.stringify(t))changed();
 }
 async function refresh(initial=false){
  if(!valid())return;if(refreshing||!initial&&!callbacks.safe?.()){refreshDeferred=true;return}refreshDeferred=false;refreshing=true;const generation=epoch,current=user;
  try{const rows=[];for(let n=0;n<indexPages;n++){const part=await rpc('conversation_index',{page_offset:n*100});rows.push(...part);more=part.length===100;if(!more)break}
   if(!same(current,generation)||!initial&&callbacks.safe?.()===false)return;const prior=JSON.stringify(book),local=new Map(book.threads.map(t=>[t.id,t])),next=[];
   for(const row of rows){const old=local.get(row.id),meta=queue[row.id]?M.mergeMetadata(row.metadata,queue[row.id].meta,queue[row.id].base):row.metadata;knownMeta.set(row.id,JSON.stringify(row.metadata));next.push({...meta,id:row.id,revision:row.revision,readOnly:!row.owner,sharedHousehold:row.sharedHousehold,messages:old?.messages||[],loaded:old?.loaded||false,before:old?.before,hasOlder:old?.hasOlder});local.delete(row.id)}
   for(const t of local.values()){if(t.revision&&!more){delete queue[t.id];knownMeta.delete(t.id);for(const m of t.messages||[])knownMessages.delete(m.id);continue}if(!t.readOnly&&(queue[t.id]||!t.revision&&(t.messages.length||!next.length)||more))next.push(t)}saveQueue();
   book.threads=next;if(!next.some(t=>t.id===book.active))book.active=next.find(t=>!t.readOnly&&(t.title||t.recipe))?.id||next.find(t=>!t.readOnly)?.id||next[0]?.id;
   ready=true;issue='';lastIndexRefresh=Date.now();if(prior!==JSON.stringify(book))changed();else status();
   if(book.active&&(!initial||!book.threads.find(t=>t.id===book.active)?.loaded))await loadThread(book.active);
  }catch(e){if(generation===epoch){issue='failed';status()}}finally{if(generation===epoch)refreshing=false}
 }
 function scheduleRefresh(){refreshDeferred=true;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(),350)}
 function queuePhoto(id,image){media.set(id,image)}
 async function share(id,hid){const current=user,generation=epoch;await flush();if(generation!==epoch)throw Error('Account changed');if(queue[id])throw Error('Sync pending');await rpc('share_conversation',{cid:id,hid},current);const t=book.threads.find(t=>t.id===id);if(t?.kind==='recipe'){t.recipeHousehold=hid;capture(book)}await refresh()}
 async function fork(t){const current=user,generation=epoch;while(t.hasOlder){await loadThread(t.id,true);guard(current,generation);t=book.threads.find(x=>x.id===t.id);if(!t)throw Error('Conversation access denied')}const copy=structuredClone(t);copy.id=crypto.randomUUID();copy.readOnly=false;copy.sharedHousehold=null;copy.revision=0;delete copy.parentId;copy.kind=t.kind==='recipe'?'recipe':'chat';const cloned=new Map(),clone=async r=>{if(!r.recipeId)return r;if(!cloned.has(r.recipeId))cloned.set(r.recipeId,await rpc('clone_recipe_document',{rid:r.recipeId,new_id:crypto.randomUUID()},current));return {...r,recipeId:cloned.get(r.recipeId)}};copy.messages=await Promise.all(copy.messages.map(async m=>({...m,id:crypto.randomUUID(),sequence:undefined,photo:undefined,photoPath:undefined,recipes:await Promise.all(m.recipes.map(clone))})));if(copy.recipe)copy.recipe=await clone(copy.recipe);if(generation!==epoch)throw Error('Account changed');book.threads.unshift(copy);book.active=copy.id;capture(book);changed();return copy.id}
 async function remove(id){const generation=epoch;await rpc('delete_conversation',{cid:id});if(generation!==epoch)return;delete queue[id];book.threads=book.threads.filter(t=>t.id!==id);book.active=book.threads.find(t=>!t.readOnly)?.id;saveQueue();changed()}
 window.addEventListener('online',()=>{refresh().then(()=>flush())});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().then(()=>flush())});
 document.addEventListener('focusout',()=>{if(refreshDeferred)scheduleRefresh()});
 setInterval(()=>{if(!document.hidden&&valid()){if(!running){if(refreshDeferred||!live?.healthy?.()||Date.now()-lastIndexRefresh>=60000)refresh().then(()=>flush());else flush()}}},15000);
 async function beginTurn(id,{signal}={}){
  const current=user,generation=epoch;
  const work=(async()=>{
   await flush(current,generation);guard(current,generation);signal?.throwIfAborted();
   if(queue[id]||!ready)throw Error('History sync pending');
   const turn=crypto.randomUUID();let acquired=false;
   try{
    // Do not abort an in-flight lock RPC: observe its result and release a granted lock.
    let page=null;
    if(turnPageSupported!==false){
     try{const result=await rpc('begin_conversation_turn_page',{cid:id,tid:turn},current);if(typeof result?.acquired!=='boolean')throw Error('Invalid turn response');turnPageSupported=true;acquired=result.acquired;page=result.page}
     catch(e){if(e.code==='PGRST202'||/Could not find.*begin_conversation_turn_page|function.*begin_conversation_turn_page.*does not exist/i.test(e.message||''))turnPageSupported=false;else throw e}
    }
    // A missing additive RPC uses the existing deployed contract until rollout.
    if(turnPageSupported===false){guard(current,generation);signal?.throwIfAborted();acquired=await rpc('begin_conversation_turn',{cid:id,tid:turn},current)}
    if(!acquired)throw Error('Another device is answering');guard(current,generation);signal?.throwIfAborted();
    await loadThread(id,false,true,page,false);guard(current,generation);signal?.throwIfAborted();turnAccounts.set(turn,{account:current,generation});return turn;
   }catch(e){if(acquired)await rpc('end_conversation_turn',{cid:id,tid:turn},current).catch(()=>{});throw e}
  })();
  if(!signal)return work;
  return new Promise((resolve,reject)=>{
   const cancel=()=>reject(signal.reason);signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
   work.then(turn=>{signal.removeEventListener('abort',cancel);if(signal.aborted){endTurn(id,turn);reject(signal.reason)}else resolve(turn)},error=>{signal.removeEventListener('abort',cancel);reject(error)});
  });
 }

 function endTurn(id,turn){const owner=turnAccounts.get(turn);turnAccounts.delete(turn);return owner&&same(owner.account,owner.generation)?rpc('end_conversation_turn',{cid:id,tid:turn},owner.account).catch(()=>{}):Promise.resolve()}
 async function finishTurn(id,turn){
  const owner=turnAccounts.get(turn);
  try{if(owner)await flush(owner.account,owner.generation)}finally{await endTurn(id,turn)}
 }
 async function archiveShared(id,archived){await rpc('archive_shared_conversation',{cid:id,archived});await refresh()}
 return {archiveShared,beginTurn,endTurn,finishTurn,attach,detach,capture,flush,refresh,loadThread,ensureRecipe,queuePhoto,share,fork,remove,more:()=>more,moreHistory:async()=>{indexPages++;await refresh()},retry:()=>{issue='';refresh().then(()=>flush())},status:()=>issue||(!ready?'loading':Object.keys(queue).length?'pending':'synced')};
})();
