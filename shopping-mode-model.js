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
   if(old){if(sessionId&&!old.done){const {shoppingSession,...purchase}=fields;Object.assign(old,purchase)}continue}
   next.cart.push({name,quantity:1,unit:unitFor(name),source:sessionId?'Vásárlás közben':'Saját tétel',addedBy:actor,addedAt:now,...fields});
   if(![...known,...next.custom].some(i=>norm(i.name)===norm(name)))next.custom.push({name,emoji:'🫙',category:'Saját tételek'});
  }return next;
 }
 function check(source,name,done,actor,now){return {...source,cart:source.cart.map(i=>i.name===name?{...i,done,...(done?{purchasedBy:actor,purchasedAt:now}:{purchasedBy:null,purchasedAt:null})}:i)}}
 function summary(source,s){const bought=source.cart.filter(i=>i.done);return {total:source.cart.length,bought:bought.length,remaining:source.cart.length-bought.length,added:source.cart.filter(i=>i.shoppingSession===s?.id).length,removed:s?.removed?.length||0}}
 const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
 function category(item,fallback){return typeof item.category==='string'&&item.category.trim()&&item.category.length<=80&&!/[\u0000-\u001f]/.test(item.category)?item.category:fallback(item.name)}
 function groups(source,order,categoryFor){const result=[];for(const item of source.cart){const name=category(item,categoryFor);let group=result.find(g=>g.name===name);if(!group){group={name,total:0,remaining:0};result.push(group)}group.total++;if(!item.done)group.remaining++}const rank=c=>order.includes(c)?order.indexOf(c):order.length;return result.sort((a,b)=>Number(!a.remaining)-Number(!b.remaining)||rank(a.name)-rank(b.name))}
 // Undo only this action's fields; never rewind a whole shared-list snapshot.
 function receipt(before,after){return after.cart.flatMap(item=>{const prior=before.cart.find(i=>i.name===item.name),keys=Object.keys(item).filter(k=>k!=='name'&&!equal(item[k],prior?.[k]));if(prior&&!keys.length)return [];const guardKeys=prior?keys:Object.keys(item);const when=Object.fromEntries(guardKeys.filter(k=>k!=='purchasedAt'&&k!=='addedAt').map(k=>[k,item[k]??null]));return [{name:item.name,created:!prior,when,fields:Object.fromEntries(keys.map(k=>[k,prior?.[k]??null]))}]})}
 function undo(source,receipt){const expected={},next={...source,cart:source.cart.map(i=>({...i}))};for(const op of receipt){const i=next.cart.findIndex(item=>item.name===op.name);if(i<0||!Object.entries(op.when).every(([k,v])=>equal(next.cart[i][k],v)))continue;expected[op.name]=op.when;if(op.created)next.cart.splice(i,1);else Object.assign(next.cart[i],op.fields)}return {next,expected,changed:Object.keys(expected).length}}
 function edit(source,name,fields,categories){const item=source.cart.find(i=>i.name===name);if(!item||!Number.isFinite(fields.quantity)||fields.quantity<1||fields.quantity>999||!['db','kg','g','l','ml','csomag','doboz','üveg','pohár'].includes(fields.unit)||!categories.includes(fields.category)||typeof fields.notes!=='string'||fields.notes.length>160)return null;return {...source,cart:source.cart.map(i=>i.name===name?{...i,...fields}:i)}}
 return {key,route,session,add,check,summary,category,groups,receipt,undo,edit};
})();
if(typeof module!=='undefined')module.exports=ShoppingModeModel;
