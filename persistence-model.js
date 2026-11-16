// Pure sync helpers. Executable AI proposals never enter persisted history.
const PersistenceModel=(()=>{
 const Cooking=typeof CookingSession==='undefined'?require('./cooking-session'):CookingSession;
 const weeklySettings=value=>(typeof WeeklyPlanModel==='undefined'?require('./weekly-plan-model'):WeeklyPlanModel).settings(value);
 const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
 const accountKey=user=>'morzsa-cloud-chats-v1:'+user;
 const metadata=t=>({... (t.weeklyPlan?{weeklyPlan:weeklySettings(t.weeklyPlan)}:{}),kind:t.kind||'chat',title:t.title||'',language:t.language||'hu',updated:t.updated||Date.now(),...(t.archivedAt?{archivedAt:t.archivedAt}:{}),...(t.parentId?{parentId:t.parentId}:{}),...(t.recipe?{recipe:t.recipe,...(t.portions?{portions:t.portions}:{}),...(t.cooking?{cooking:Cooking.normalize(t.cooking,t.recipe,t.status)}:{}),status:t.status||'active',cookingStep:t.cookingStep||0,completedSteps:t.completedSteps||[]}: {})});
 const message=m=>({id:m.id,role:m.role,text:m.text,createdAt:m.createdAt,recipes:m.recipes||[],...(m.result?{result:m.result}:{}),...(m.archived?{archived:true}:{}),...(m.provider?{provider:m.provider}:{}),...(m.photoPath?{photoPath:m.photoPath}:{})});
 function mergeMessages(remote,local=[],pending=[]){const dirty=new Set(pending.map(m=>m.id)),map=new Map(remote.map(m=>[m.id,m]));for(const m of local){if(!map.has(m.id)||dirty.has(m.id))map.set(m.id,m);else if(m.photo)map.set(m.id,{...map.get(m.id),photo:m.photo})}return [...map.values()].sort((a,b)=>a.sequence&&b.sequence?a.sequence-b.sequence:(a.createdAt||0)-(b.createdAt||0)||a.id.localeCompare(b.id))}
 function mergeProgress(remote,local){const done=[...new Set([...(remote.completedSteps||[]),...(local.completedSteps||[])])].sort((a,b)=>a-b);return {...remote,...(local.cooking||remote.cooking?{cooking:Cooking.merge(remote.cooking,local.cooking)}:{}),...(done.length?{completedSteps:done,cookingStep:Math.max(remote.cookingStep||0,local.cookingStep||0),status:remote.status==='completed'||local.status==='completed'?'completed':'active'}:{})}}
 function mergeMetadata(remote,local,base){
  if(!base)return {...remote,...local};
  const merged={...remote};
  for(const key of new Set([...Object.keys(base),...Object.keys(local)])){
   if(JSON.stringify(local[key])===JSON.stringify(base[key]))continue;
   if(Object.hasOwn(local,key))merged[key]=local[key];else delete merged[key];
  }
  const done=[...new Set([...(remote.completedSteps||[]),...(local.completedSteps||[])])].sort((a,b)=>a-b);
  if(done.length){merged.completedSteps=done;merged.cookingStep=JSON.stringify(local.cookingStep)!==JSON.stringify(base.cookingStep)&&local.cookingStep<base.cookingStep?local.cookingStep:Math.max(remote.cookingStep||0,local.cookingStep||0);merged.status=remote.status==='completed'||local.status==='completed'?'completed':'active'}
  if(local.cooking||remote.cooking){merged.cooking=Cooking.merge(remote.cooking,local.cooking);if(base?.cooking&&JSON.stringify(local.cooking?.feedback)===JSON.stringify(base.cooking?.feedback))merged.cooking.feedback=remote.cooking?.feedback||local.cooking?.feedback;}
  return merged;
 }
 function rank(list,{stock={},favourites=[],recent=[],prefs={},month=new Date().getMonth()+1}={}){
  const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const score=r=>{const names=(r.ingredients||[]).map(i=>i.name),coverage=names.filter(n=>stock[n]>0).length/Math.max(1,names.length);return coverage*10+(favourites.includes(r.id)?3:0)+(r.minutes<=30?1:0)+(r.tags?.includes(month>=10||month<=2?'téli':'nyári')?2:0)-(recent.includes(r.title)?3:0)};
  const safe=list.filter(r=>(!prefs.maxMinutes||r.minutes<=prefs.maxMinutes)&&(!prefs.diet||prefs.diet==='any'||r.tags?.includes(prefs.diet))&&!(prefs.avoid||[]).some(n=>(r.ingredients||[]).some(i=>norm(i.name).includes(norm(n)))));
  const familiar=[...safe].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id)),used=new Set(),out=[];
  // Every fourth card explores within the same dietary restrictions; no LLM call.
  for(let i=0;i<safe.length;i++){const pool=i%4===3?[...safe].sort((a,b)=>a.id.localeCompare(b.id)):familiar;const next=pool.find(r=>!used.has(r.id));if(next){used.add(next.id);out.push(next)}}return out;
 }
 return {uuid,accountKey,metadata,message,mergeMessages,mergeProgress,mergeMetadata,rank};
})();
if(typeof module!=='undefined')module.exports=PersistenceModel;
