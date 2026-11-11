// Local conversations and suggestions; existing household record formats stay intact.
const CompanionModel = (() => {
 const thumbnail=v=>typeof v==='string'&&v.length<=16000&&/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(v)?v:null;
 const key=(user,home,lang)=>'morzsa-companion-v1:'+JSON.stringify([user||'guest',home||'local',lang]);
 const fresh=(id,now=Date.now())=>({id,title:'',updated:now,messages:[]});
 function normalize(value,validRecipe=()=>null,maxThreads=20){
  const threads=(Array.isArray(value?.threads)?value.threads:[]).filter(t=>t&&typeof t.id==='string').slice(0,maxThreads).map(t=>({id:t.id,title:String(t.title||'').slice(0,80),updated:Number(t.updated)||0,...(['main','recipe','legacy'].includes(t.kind)?{kind:t.kind}:{}),...(t.kind==='recipe'&&validRecipe(t.recipe)?{recipe:validRecipe(t.recipe),status:t.status==='completed'?'completed':'active'}:{}),messages:(Array.isArray(t.messages)?t.messages:[]).filter(m=>m&&['user','model'].includes(m.role)&&typeof m.text==='string').slice(-40).map(m=>({role:m.role,text:m.text.slice(0,5000),...(m.role==='user'&&thumbnail(m.photo)?{photo:m.photo}:{}),...(m.provider==='recipes'?{provider:'recipes'}:{}),recipes:(Array.isArray(m.recipes)?m.recipes:[]).map(validRecipe).filter(Boolean).slice(0,3),...(typeof m.result==='string'?{result:m.result.slice(0,500)}:{})}))}));
  let photos=0;for(const t of [...threads].sort((a,b)=>b.updated-a.updated))for(const m of [...t.messages].reverse())if(m.photo&&++photos>30)delete m.photo;
  return {version:1,active:threads.some(t=>t.id===value?.active)?value.active:threads[0]?.id,threads};
 }
 // Separate storage leaves the v1 history untouched for older installed clients.
 const workspaceKey=(user,home,lang)=>key(user,home,lang).replace('companion-v1:','companion-v2:');
 function workspace(value,validRecipe,now=Date.now()){
  const clean=normalize(value,validRecipe,61),main=clean.threads.find(t=>t.kind==='main');
  let id='morzsa-main';while(clean.threads.some(t=>t.id===id))id+='-';
  const primary=main||{...fresh(id,now),kind:'main'},seen=new Set([primary.id]);
  const others=clean.threads.filter(t=>{if(t===main||seen.has(t.id))return false;seen.add(t.id);return true}).map(t=>({...t,kind:t.kind==='recipe'&&t.recipe?'recipe':'legacy'}));
  return {version:2,active:clean.threads.some(t=>t.id===clean.active)?clean.active:primary.id,threads:[primary,...others].slice(0,61)};
 }
 const recipeKey=r=>JSON.stringify([r.title,r.ingredients,r.steps]);
 function startRecipe(book,recipe,id,validRecipe,now=Date.now()){
  const r=validRecipe(recipe);if(!r)throw Error('INVALID_RECIPE');const next=workspace(book,validRecipe,now);
  let t=next.threads.find(t=>t.kind==='recipe'&&t.status==='active'&&recipeKey(t.recipe)===recipeKey(r));
  if(!t){if(next.threads.length>=61)throw Error('THREAD_LIMIT');if(next.threads.some(t=>t.id===id))throw Error('DUPLICATE_THREAD');t={...fresh(id,now),kind:'recipe',title:r.title,recipe:r,status:'active'};next.threads.splice(1,0,t)}
  next.active=t.id;return next;
 }
 function finishRecipe(book,id,validRecipe,label,now=Date.now()){
  const next=workspace(book,validRecipe,now),t=next.threads.find(t=>t.id===id);
  if(!t||t.kind!=='recipe'||t.status==='completed')return next;
  t.status='completed';t.updated=now;const main=next.threads.find(t=>t.kind==='main');
  main.messages.push({role:'model',text:label+t.title,recipes:[t.recipe]});main.updated=now;
  return workspace(next,validRecipe,now);
 }
 function history(messages,limit=6){return messages.slice(-Math.min(12,limit)).map(m=>({role:m.role,text:(m.text+(m.photo?' [Photo was attached; image is not available in this history.]':'')+(m.recipes?.length?' Recipes: '+JSON.stringify(m.recipes):'')+(m.result?' Change status: '+m.result:'')).slice(0,5000)}))}
 function reviewPreview(reviews,stock,deferred={},now=Date.now()){return reviews.filter(i=>stock[i.name]>0&&!(deferred['review:'+i.name]>now)).slice(0,8)}
 function suggestion(state,reviews,removed=[],deferred={},now=Date.now()){
  const allowed=id=>!(deferred[id]>now),bought=state.cart.filter(i=>i.done);
  const id='bought:'+JSON.stringify(bought.map(i=>[i.name,i.quantity,i.unit]).sort());
  if(bought.length&&allowed(id))return {id,type:'bought',names:bought.map(i=>i.name)};
  const name=removed.find(n=>!state.stock[n]&&!state.cart.some(i=>i.name===n)&&allowed('restock:'+n));
  if(name)return {id:'restock:'+name,type:'restock',names:[name]};
  const item=reviews.find(i=>state.stock[i.name]>0&&allowed('review:'+i.name));
  return item?{id:'review:'+item.name,type:'review',names:[item.name],unknown:item.unknown}:null;
 }
 // Only touched records participate, allowing unrelated concurrent changes.
 function fingerprint(state,operations,revision=()=>null){return JSON.stringify(operations.map(o=>[o.action,o.name,o.action==='list_set'?state.cart.find(i=>i.name===o.name)||null:state.stock[o.name]||0,revision(o.action==='list_set'?'cart':'stock',o.name)]))}
 function changes(before,after){
  const changes=[];for(const bucket of ['stock','cart','history']){const entries=s=>bucket==='stock'?Object.entries(s.stock):s[bucket].map(i=>[bucket==='history'?i.id:i.name,i]),a=new Map(entries(before)),b=new Map(entries(after));for(const key of new Set([...a.keys(),...b.keys()]))if(JSON.stringify(a.get(key))!==JSON.stringify(b.get(key)))changes.push({bucket,key,before:a.get(key),after:b.get(key)})}return changes;
 }
 return {thumbnail,key,fresh,normalize,workspaceKey,workspace,startRecipe,finishRecipe,recipeKey,history,reviewPreview,suggestion,fingerprint,changes};
})();
if(typeof module!=='undefined')module.exports=CompanionModel;
