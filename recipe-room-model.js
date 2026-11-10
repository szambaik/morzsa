// Additive, device-local recipe storage; household records keep their existing format.
const RecipeRoomModel = (() => {
 const text=(s,n)=>typeof s==='string'&&s.trim()&&s.length<=n;
 function recipe(r){
  if(!r||!text(r.title,100)||!text(r.summary,400)||!Number.isInteger(r.minutes)||r.minutes<1||r.minutes>240||!Array.isArray(r.ingredients)||!r.ingredients.length||r.ingredients.length>15||!r.ingredients.every(i=>text(i?.name,80)&&text(i.amount,80))||!Array.isArray(r.steps)||!r.steps.length||r.steps.length>6||!r.steps.every(s=>text(s,500)))return null;
  return {title:r.title,summary:r.summary,minutes:r.minutes,ingredients:r.ingredients.map(i=>({name:i.name,amount:i.amount})),steps:[...r.steps]};
 }
 const identity=r=>JSON.stringify([r.title,r.ingredients,r.steps]);
 const conversationKey=(user,home,lang)=>'morzsa-recipe-room-v1:'+JSON.stringify([user||'guest',home||'local',lang]);
 const favouritesKey=user=>'morzsa-recipe-favourites-v1:'+JSON.stringify(user||'guest');
 function messages(value){return (Array.isArray(value)?value:[]).filter(m=>m&&['user','model'].includes(m.role)&&text(m.text,4000)).slice(-20).map(m=>({role:m.role,text:m.text,recipes:(Array.isArray(m.recipes)?m.recipes:[]).map(recipe).filter(Boolean).slice(0,3)}))}
 function favourites(value){return (Array.isArray(value)?value:[]).map(recipe).filter(Boolean).filter((r,i,a)=>a.findIndex(x=>identity(x)===identity(r))===i).slice(0,100)}
 function toggle(saved,r){const key=identity(r);return saved.some(x=>identity(x)===key)?saved.filter(x=>identity(x)!==key):[r,...saved].slice(0,100)}
 function history(value){
  // Preserve complete recent turns within the edge request's 32KB envelope.
  const result=[];let bytes=0;
  for(const m of messages(value).slice(-6).reverse()){
   let content=m.role==='model'?JSON.stringify({answer:m.text,recipes:m.recipes}):m.text;
   if(content.length>4000)content=m.text.slice(0,500)+' '+m.recipes.map(r=>r.title+': '+r.ingredients.map(i=>i.name+' '+i.amount).join(', ')+'. '+r.steps.join(' ')).join(' | ');
   content=content.slice(0,4000);while(new TextEncoder().encode(content).length>4500)content=content.slice(0,-100);
   if(content.length>4000||bytes+new TextEncoder().encode(content).length>10000)break;
   result.unshift({role:m.role,text:content});bytes+=new TextEncoder().encode(content).length;
  }
  if(result[0]?.role==='model'){if(result.length===6)result.shift();else result.unshift({role:'user',text:'Previous recipe context:'})}return result;
 }
 function addMissing(source,r,resolve,unitFor){
  const norm=n=>n.normalize('NFC').trim().toLocaleLowerCase('hu'),known=new Set(source.cart.map(i=>norm(i.name))),stock=new Set(Object.keys(source.stock).filter(n=>source.stock[n]>0).map(norm));
  const added=[];for(const i of r.ingredients){const name=resolve(i.name),key=norm(name);if(stock.has(key)||known.has(key))continue;known.add(key);added.push({name,source:r.title,quantity:1,unit:unitFor(name),done:false})}
  return {...source,cart:[...source.cart,...added]};
 }
 return {recipe,identity,conversationKey,favouritesKey,messages,favourites,toggle,history,addMissing};
})();
if(typeof module!=='undefined')module.exports=RecipeRoomModel;
