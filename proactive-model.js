// Evidence-based proposals. This module never changes pantry or shopping state.
const ProactiveModel = (() => {
 const DAY=86400000, norm=s=>String(s).normalize('NFC').trim().toLocaleLowerCase('hu');
 const validName=n=>typeof n==='string'&&n.trim()&&n.length<=160&&!/[\u0000-\u001f]/.test(n)&&!['__proto__','constructor','prototype'].includes(n);
 const median=a=>{const s=[...a].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2};
 function patterns(history=[],now=Date.now()){
  const dates=new Map();
  for(const trip of history){
   const at=Date.parse(trip?.date);
   if(!Number.isFinite(at)||at>now||at<now-180*DAY||trip.kind&&trip.kind!=='purchase')continue;
   for(const item of Array.isArray(trip.items)?trip.items:[]){
    if(!validName(item?.name))continue;const key=norm(item.name),entry=dates.get(key)||{name:item.name,days:new Map()};
    // Multiple archives or purchases on one UTC day are one observation.
    const day=Math.floor(at/DAY);entry.days.set(day,Math.max(at,entry.days.get(day)||0));dates.set(key,entry);
   }
  }
  return [...dates.values()].flatMap(({name,days})=>{
   const times=[...days.values()].sort((a,b)=>a-b);if(times.length<3)return [];
   const gaps=times.slice(1).map((t,i)=>(t-times[i])/DAY),interval=median(gaps),spread=Math.max(...gaps)-Math.min(...gaps);
   if(interval<2||interval>60||spread>interval)return [];
   return [{name,days:interval,last:times.at(-1),samples:times.length,confidence:times.length>=5&&spread<=interval/2?'medium':'low'}];
  });
 }
 function cleanFeedback(value={}){
  return Object.fromEntries(Object.entries(value&&typeof value==='object'?value:{}).filter(([key,v])=>key.length<=220&&v&&Number.isFinite(v.until)&&Number.isFinite(v.at)).slice(-500));
 }
 const feedbackKey=s=>s.kind==='recipe'?'recipe:'+s.recipeId:'product:'+norm(s.name);
 function visible(s,feedback,now=Date.now()){const f=feedback[feedbackKey(s)];return !(f?.until>now)}
 function respond(feedback,s,action,now=Date.now()){
  if(!['accepted','dismissed','later','still_here','opened','useful'].includes(action))throw Error('Invalid feedback');
  const key=feedbackKey(s),old=cleanFeedback(feedback)[key]||{},corrections=(old.corrections||0)+(action==='still_here'?1:0);
  const days=action==='later'?3:action==='still_here'?Math.max(7,Math.min(60,(s.days||7)*(1+Math.min(corrections,3)*.25))):action==='dismissed'?7:action==='opened'?1:2;
  return {...cleanFeedback(feedback),[key]:{action,at:now,until:now+days*DAY,corrections,counts:{...old.counts,[action]:(old.counts?.[action]||0)+1}}};
 }
 function candidates(state,{reviews=[],feedback={},confirmedAt=()=>NaN,now=Date.now()}={}){
  const stock=state.stock||{},listed=new Set((state.cart||[]).map(i=>norm(i.name))),byName=new Map(Object.keys(stock).filter(validName).map(n=>[norm(n),n])),result=[];
  const add=s=>{s.id=feedbackKey(s);s.expiresAt=now+DAY;if(!listed.has(norm(s.name))&&visible(s,feedback,now))result.push(s)};
  for(const [name,value] of Object.entries(stock)){if(!validName(name))continue;if(value===0||value===1)add({kind:value===0?'out':'low',name,source:'pantry',confidence:'confirmed',score:value===0?100:90,fingerprint:JSON.stringify([value])})}
  for(const p of patterns(state.history,now)){
   const name=byName.get(norm(p.name))||p.name;if(result.some(s=>norm(s.name)===norm(name))||stock[name]===0||stock[name]===1)continue;
   const correction=feedback['product:'+norm(name)],days=p.days*(1+Math.min(correction?.corrections||0,3)*.25);
   // Purchasing cadence is not consumption: no claim of remaining quantity.
   const confirmed=confirmedAt(name);if(confirmed>p.last&&now-confirmed<2*DAY)continue;
   const due=p.last+days*DAY;if(now<due-2*DAY||now>due+days*DAY)continue;
   if(correction?.action==='still_here'&&now<correction.at+days*DAY)continue;
   add({...p,name,days,kind:'recurring',source:'purchases',score:65,remaining:Math.max(0,Math.ceil((due-now)/DAY)),fingerprint:JSON.stringify([stock[name]??null,p.last])});
  }
  for(const r of reviews){if(!validName(r.name)||!(stock[r.name]>0)||result.some(s=>norm(s.name)===norm(r.name)))continue;add({...r,kind:'review',source:'last_check',confidence:'unknown',score:40+(r.unknown?0:Math.min(10,r.age||0)),fingerprint:JSON.stringify([stock[r.name],r.at||null])})}
  return result.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'hu')).slice(0,20);
 }
 function rankRecipes(list,{stock={},uncertain=[],resolve=n=>n,prefs={},favourites=[],recent=[],feedback={},accepts=()=>true,now=Date.now()}={}){
  const unknown=new Set(uncertain),seen=new Set(),liked=new Set(favourites),recentSet=new Set(recent);
  return list.flatMap(r=>{
   const id=String(r.recipeId||r.id||r.title||r.name);if(seen.has(id)||!accepts(r))return [];seen.add(id);
   const ingredients=[...new Set((r.ingredients||[]).map(i=>resolve(Array.isArray(i)?i[0]:i.name)|| (Array.isArray(i)?i[0]:i.name)))];if(!ingredients.length)return [];
   const home=ingredients.filter(n=>stock[n]>0&&!unknown.has(n)),check=ingredients.filter(n=>stock[n]>0&&unknown.has(n)),missing=ingredients.filter(n=>!(stock[n]>0));
   if(!home.length&&!check.length)return [];
   const minutes=Number(r.minutes||r.time)||0,favourite=liked.has(id),title=r.title||r.name,score=home.length/ingredients.length*60+home.length*3+check.length*2-missing.length*4+(favourite?8:0)+Math.min(6,(feedback['recipe:'+id]?.counts?.useful||0)*2)+(minutes>0&&minutes<=(prefs.maxMinutes||30)?5:0)-(recentSet.has(title)?10:0);
   const suggestion={id:'recipe:'+id,kind:'recipe',recipeId:id,recipe:r,home,check,missing,total:ingredients.length,minutes,servings:r.servings||null,favourite,score,source:'pantry_match',confidence:check.length?'unknown':'confirmed',expiresAt:now+DAY};
   return visible(suggestion,feedback,now)?[suggestion]:[];
  }).sort((a,b)=>b.score-a.score||a.recipeId.localeCompare(b.recipeId)).slice(0,3);
 }
 function listPlan(state,suggestions,unitFor){
  const cart=state.cart.map(i=>({...i})),listed=new Set(cart.map(i=>norm(i.name))),added=[];
  for(const s of suggestions){if(!['out','low','recurring'].includes(s.kind)||!validName(s.name)||listed.has(norm(s.name)))continue;listed.add(norm(s.name));added.push(s.name);cart.push({name:s.name,quantity:1,unit:unitFor(s.name),done:false,source:'Morzsa javaslata'})}
  return {next:{...state,cart},added};
 }
 return {DAY,norm,patterns,cleanFeedback,feedbackKey,visible,respond,candidates,rankRecipes,listPlan};
})();
if(typeof module!=='undefined')module.exports=ProactiveModel;
