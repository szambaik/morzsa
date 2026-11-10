// Local conversations and suggestions; existing household record formats stay intact.
const CompanionModel = (() => {
 const key=(user,home,lang)=>'morzsa-companion-v1:'+JSON.stringify([user||'guest',home||'local',lang]);
 const fresh=(id,now=Date.now())=>({id,title:'',updated:now,messages:[]});
 function normalize(value,validRecipe=()=>null){
  const threads=(Array.isArray(value?.threads)?value.threads:[]).filter(t=>t&&typeof t.id==='string').slice(0,20).map(t=>({id:t.id,title:String(t.title||'').slice(0,80),updated:Number(t.updated)||0,messages:(Array.isArray(t.messages)?t.messages:[]).filter(m=>m&&['user','model'].includes(m.role)&&typeof m.text==='string').slice(-40).map(m=>({role:m.role,text:m.text.slice(0,5000),recipes:(Array.isArray(m.recipes)?m.recipes:[]).map(validRecipe).filter(Boolean).slice(0,3),...(typeof m.result==='string'?{result:m.result.slice(0,500)}:{})}))}));
  return {version:1,active:threads.some(t=>t.id===value?.active)?value.active:threads[0]?.id,threads};
 }
 function history(messages){return messages.slice(-6).map(m=>({role:m.role,text:(m.text+(m.recipes?.length?' Recipes: '+JSON.stringify(m.recipes):'')+(m.result?' Change status: '+m.result:'')).slice(0,5000)}))}
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
 return {key,fresh,normalize,history,suggestion,fingerprint,changes};
})();
if(typeof module!=='undefined')module.exports=CompanionModel;
