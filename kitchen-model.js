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
 function shoppingSuggestion(state,deferred={},now=Date.now()){
  const eligible=n=>!state.cart.some(i=>norm(i.name)===norm(n));
  const low=Object.keys(state.stock).filter(n=>state.stock[n]===1&&eligible(n)),out=Object.keys(state.stock).filter(n=>state.stock[n]===0&&eligible(n));
  const trips=new Map();for(const h of state.history||[]){const time=Date.parse(h.date);if(!Number.isFinite(time)||time>now||time<now-60*86400000)continue;for(const name of new Set((h.items||[]).map(i=>i.name).filter(n=>typeof n==='string')))trips.set(name,(trips.get(name)||0)+1)}
  const recurring=out.filter(n=>(trips.get(n)||0)>=2).sort((a,b)=>trips.get(b)-trips.get(a));
  for(const [type,source] of [['low',low],['recurring',recurring]]){const names=source.filter(n=>!(deferred['refill:'+n]>now)).slice(0,3);if(names.length)return {id:'refill:'+names.join('|'),type,names}}return null;
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
 return {defaults,preferences,preferenceChanges,fromRows,recentRecipes,shoppingSuggestion,context,accepts};
})();
if(typeof module!=='undefined')module.exports=KitchenModel;
