// Household context is data, never an instruction or a second pantry store.
const KitchenModel=(()=>{
 const defaults={servings:2,maxMinutes:0,diet:'any',avoid:[]};
 const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').trim().toLowerCase();
 function preferences(value={}){return {servings:Number.isInteger(value.servings)&&value.servings>=1&&value.servings<=8?value.servings:2,maxMinutes:[0,25,45,60].includes(value.maxMinutes)?value.maxMinutes:0,diet:['any','vegetarian','vegan'].includes(value.diet)?value.diet:'any',avoid:[...new Set((Array.isArray(value.avoid)?value.avoid:[]).filter(n=>typeof n==='string'&&n.trim()&&n.length<=80&&!/[\u0000-\u001f]/.test(n)).map(n=>n.trim()))].slice(0,10)}}
 function preferenceChanges(rows,before,after){const clean=preferences(after),prior=preferences(before);return Object.keys(defaults).filter(key=>JSON.stringify(clean[key])!==JSON.stringify(prior[key])).map(key=>({key,value:clean[key],expected:Number(rows.find(r=>r.key===key)?.revision)||0}))}
 function fromRows(rows){return preferences(Object.fromEntries(rows.filter(r=>Object.hasOwn(defaults,r.key)).map(r=>[r.key,r.value])))}
 function recentRecipes(book={},events=[],now=Date.now()){
  const cutoff=now-30*86400000,items=[...(book.threads||[]).filter(t=>t.kind==='recipe'&&t.status==='completed').map(t=>({title:t.recipe?.title,time:t.updated})),...events.filter(e=>e.event_type==='recipe_completed').map(e=>({title:e.subject,time:Date.parse(e.created_at)}))];
  const seen=new Set();return items.filter(i=>typeof i.title==='string'&&i.title.length<=120&&i.time>=cutoff&&i.time<=now).sort((a,b)=>b.time-a.time).filter(i=>{const key=norm(i.title);if(seen.has(key))return false;seen.add(key);return true}).slice(0,6).map(i=>i.title);
 }
 function purchasePatterns(history=[],now=Date.now()){
  const seen=new Set(),counts=new Map();
  for(const h of history){const time=Date.parse(h.date);if(!Number.isFinite(time)||time>now||time<now-60*86400000||h.kind&&h.kind!=='purchase')continue;
   const names=new Map();for(const item of h.items||[]){const name=item?.name;if(typeof name!=='string'||!name.trim()||name.length>80||/[\u0000-\u001f]/.test(name)||['__proto__','constructor','prototype'].includes(name.trim()))continue;names.set(norm(name),name.trim())}
   const trip=h.id?'id:'+h.id:JSON.stringify([time,[...names.keys()].sort()]);if(seen.has(trip))continue;seen.add(trip);
   for(const [key,name] of names){const prior=counts.get(key)||{name,count:0,last:0};counts.set(key,{name:time>=prior.last?name:prior.name,count:prior.count+1,last:Math.max(time,prior.last)})}
  }
  return [...counts.values()].filter(i=>i.count>=2).sort((a,b)=>b.count-a.count||b.last-a.last||a.name.localeCompare(b.name));
 }
 function patterns(history=[],favourites=[],products=[],now=Date.now()){
  const food=new Set(products.filter(i=>!['Háztartás','Saját tételek'].includes(i.category)).map(i=>norm(i.name)));
  const titles=[...new Map(favourites.filter(n=>typeof n==='string'&&n.trim()&&n.length<=120&&!/[\u0000-\u001f]/.test(n)).map(n=>[norm(n),n.trim()])).values()].slice(0,6);
  return {frequentProducts:purchasePatterns(history,now).filter(i=>food.has(norm(i.name))).slice(0,12).map(i=>i.name),favouriteRecipes:titles};
 }
 function shoppingSuggestion(state,deferred={},now=Date.now()){
  const eligible=n=>!state.cart.some(i=>norm(i.name)===norm(n));
  const low=Object.keys(state.stock).filter(n=>state.stock[n]===1&&eligible(n)),out=Object.keys(state.stock).filter(n=>state.stock[n]===0&&eligible(n));
  const trips=new Map(purchasePatterns(state.history,now).map(i=>[norm(i.name),i.count])),rank=(a,b)=>(trips.get(norm(b))||0)-(trips.get(norm(a))||0);low.sort(rank);
  const recurring=out.filter(n=>(trips.get(norm(n))||0)>=2).sort(rank);
  for(const [type,source] of [['low',low],['recurring',recurring]]){const names=source.filter(n=>!(deferred['refill:'+n]>now)).slice(0,3);if(names.length)return {id:'refill:'+names.join('|'),type,names}}return null;
 }
 function recipeChoice(recipe,stock={},uncertain=[],resolve=n=>n,prefs={}){
  const groups={home:[],low:[],out:[],unknown:[]},seen=new Set();
  for(const item of recipe.ingredients||[]){const raw=Array.isArray(item)?item[0]:item.name,name=resolve(raw)||raw;if(seen.has(name))continue;seen.add(name);const status=!Object.hasOwn(stock,name)||uncertain.includes(name)?'unknown':stock[name]===0?'out':stock[name]===1?'low':stock[name]>1?'home':'unknown';groups[status].push(name)}
  const p=preferences(prefs),minutes=recipe.minutes||recipe.time||0;
  return {...groups,total:seen.size,confirmed:groups.home.length+groups.low.length,ready:!!seen.size&&!groups.out.length&&!groups.unknown.length,timeFits:!!p.maxMinutes&&minutes>0&&minutes<=p.maxMinutes,dietFits:p.diet!=='any'&&!!recipe.tags?.includes(p.diet),diet:p.diet,maxMinutes:p.maxMinutes};
 }
 function shoppingRecommendations(state,{products=[],english={},prefs={},now=Date.now(),limit=3}={}){
  const stock=new Map(Object.entries(state.stock||{}).map(([n,value])=>[norm(n),{name:n,value}]));
  // Checked items are already purchased; never recommend buying them again here.
  const listed=new Set((state.cart||[]).map(i=>norm(i.name))),candidates=new Map();
  for(const {name,value} of stock.values())if(value===0||value===1)candidates.set(norm(name),{name,reason:value===0?'out':'low',count:0,last:0});
  for(const p of purchasePatterns(state.history,now)){
   const key=norm(p.name),known=stock.get(key),existing=candidates.get(key);
   if(existing){existing.count=p.count;existing.last=p.last}
   // A recent purchase is a reason to wait, not to suggest immediate restocking.
   else if(!known&&now-p.last>=3*86400000)candidates.set(key,{...p,reason:'frequent'});
  }
  return [...candidates.values()].filter(i=>!listed.has(norm(i.name))).map(i=>({...i,name:products.find(p=>norm(p.name)===norm(i.name))?.name||i.name}))
   .filter(i=>accepts({ingredients:[{name:i.name}]},prefs,products,english))
   .sort((a,b)=>({out:0,low:1,frequent:2}[a.reason])-({out:0,low:1,frequent:2}[b.reason])||b.count-a.count||b.last-a.last||a.name.localeCompare(b.name,'hu')).slice(0,Math.max(0,Math.min(5,limit)));
 }
 function replenishment(state,now=Date.now()){
  const trips=new Map(purchasePatterns(state.history,now).map(i=>[norm(i.name),i.count]));
  return Object.entries(state.stock).filter(([,n])=>n===0||n===1).map(([name,n])=>({name,status:n===0?'out':'low',listed:state.cart.some(i=>norm(i.name)===norm(name)&&!i.done)})).sort((a,b)=>(a.status==='out'?0:1)-(b.status==='out'?0:1)||(trips.get(norm(b.name))||0)-(trips.get(norm(a.name))||0)||a.name.localeCompare(b.name,'hu'));
 }
 function discoverySections(list,{stock={},uncertain=[],resolve=n=>n,prefs={},favourites=[],products=[],english={}}={}){
  const p=preferences(prefs),liked=new Set(favourites),seen=new Set(),used=new Set();
  const rows=list.filter(r=>{if(!r.id||seen.has(r.id)||!accepts(r,p,products,english))return false;seen.add(r.id);return true}).map(r=>({recipe:r,choice:recipeChoice(r,stock,uncertain,resolve,p)}));
  const groups=[];
  const take=(key,filter,min,max)=>{const selected=rows.filter(x=>!used.has(x.recipe.id)&&filter(x)).slice(0,max);if(selected.length<min)return;selected.forEach(x=>used.add(x.recipe.id));groups.push({key,recipes:selected.map(x=>x.recipe)})};
  // Saved favourites are evidence of preference; absent history is never invented.
  take('favourites',x=>liked.has(x.recipe.id),1,4);
  const hasPreference=p.diet!=='any'||p.maxMinutes>0||p.avoid.length>0;
  take('today',x=>x.choice.total>0&&(x.choice.confirmed/x.choice.total>=.6||hasPreference),2,2);
  take('pantry',x=>x.choice.confirmed>=2&&x.choice.confirmed/x.choice.total>=.4,2,4);
  take('quick',x=>x.recipe.minutes>0&&x.recipe.minutes<=30&&!x.recipe.tags?.some(t=>['édes','reggeli','dessert','breakfast'].includes(t)),2,4);
  const rest=rows.filter(x=>!used.has(x.recipe.id)).map(x=>x.recipe);
  if(rest.length)groups.push({key:groups.length?'more':'explore',recipes:rest.slice(0,4)});
  const order=['today','pantry','quick','favourites','more','explore'];return groups.sort((a,b)=>order.indexOf(a.key)-order.indexOf(b.key));
 }
 function context(prefs,book,events,stock,now=Date.now()){return {preferences:preferences(prefs),recentCooked:recentRecipes(book,events,now),low:Object.keys(stock).filter(n=>stock[n]===1).slice(0,1000)}}
 function accepts(recipe,prefs,products=[],english={}){
  const p=preferences(prefs),ingredients=recipe.ingredients||[];if(p.maxMinutes&&(recipe.time||recipe.minutes)>p.maxMinutes)return false;
  return ingredients.every(item=>{const name=Array.isArray(item)?item[0]:item.name,category=products.find(i=>i.name===name)?.category||'',label=norm(name+' '+(english[name]||''));
   if(p.avoid.some(n=>label.includes(norm(n))))return false;
   if(p.diet!=='any'&&['Hús és felvágott','Hal és tengeri'].includes(category))return false;
   if(p.diet==='vegan'&&(category==='Tejtermék és tojás'||/^(mez|honey)\b/.test(label)))return false;return true;
  });
 }
 return {shoppingRecommendations,discoverySections,recipeChoice,replenishment,defaults,preferences,preferenceChanges,fromRows,recentRecipes,purchasePatterns,patterns,shoppingSuggestion,context,accepts};
})();
if(typeof module!=='undefined')module.exports=KitchenModel;
