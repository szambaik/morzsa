// Shopping is a mode of the existing cart, not another list or stock store.
const ShoppingModeModel=(()=>{
 const norm=n=>String(n).normalize('NFC').trim().toLocaleLowerCase('hu');
 const key=(user,home)=>'morzsa-shopping-mode-v1:'+JSON.stringify([user||'guest',home||'local']);
 function route(value,defaults=[]){return [...new Set([...(Array.isArray(value)?value:[]).filter(c=>typeof c==='string'&&c.trim()&&c.length<=80&&!/[\u0000-\u001f]/.test(c)),...defaults])].slice(0,50)}
 function session(value){return value&&typeof value.id==='string'&&value.id.length<=80&&!value.finished_at?{id:value.id,started_by:typeof value.started_by==='string'?value.started_by:null,started_at:value.started_at||'',removed:Array.isArray(value.removed)?value.removed.slice(0,100):[]}:null}
 function add(source,names,{sessionId,actor,now,resolve=n=>n,unitFor=()=> 'db',known=[]}){
  const next=structuredClone(source),seen=new Set();
  for(const raw of names){const name=resolve(raw.trim());if(!name||name.length>80||seen.has(norm(name)))continue;seen.add(norm(name));const old=next.cart.find(i=>norm(i.name)===norm(name));
   const fields={done:!!sessionId,...(sessionId?{shoppingSession:sessionId,purchasedBy:actor,purchasedAt:now}:{} )};
   if(old){if(sessionId){const {shoppingSession,...purchase}=fields;Object.assign(old,purchase)}continue}
   next.cart.push({name,quantity:1,unit:unitFor(name),source:sessionId?'Vásárlás közben':'Saját tétel',addedBy:actor,addedAt:now,...fields});
   if(![...known,...next.custom].some(i=>norm(i.name)===norm(name)))next.custom.push({name,emoji:'🫙',category:'Saját tételek'});
  }return next;
 }
 function check(source,name,done,actor,now){return {...source,cart:source.cart.map(i=>i.name===name?{...i,done,...(done?{purchasedBy:actor,purchasedAt:now}:{purchasedBy:null,purchasedAt:null})}:i)}}
 function summary(source,s){const bought=source.cart.filter(i=>i.done);return {total:source.cart.length,bought:bought.length,remaining:source.cart.length-bought.length,added:source.cart.filter(i=>i.shoppingSession===s?.id).length,removed:s?.removed?.length||0}}
 return {key,route,session,add,check,summary};
})();
if(typeof module!=='undefined')module.exports=ShoppingModeModel;
