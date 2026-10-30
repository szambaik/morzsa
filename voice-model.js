// Pure, additive voice planning. Existing save and shared record formats stay intact.
const VoiceModel=(()=>{
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('hu').trim();
 const actions=['stock_add','stock_remove','list_set'],units=['db','kg','g','l','ml','csomag','doboz','üveg','pohár'];
 const safeName=n=>typeof n==='string'&&n.trim().length>0&&n.length<=80&&!/[\u0000-\u001f]/.test(n)&&!['__proto__','constructor','prototype'].includes(n.trim());
 function validate(v){return v&&typeof v.transcript==='string'&&v.transcript.length<=3000&&typeof v.clarification==='string'&&v.clarification.length<=500&&Array.isArray(v.operations)&&v.operations.length<=30&&v.operations.every(o=>o&&actions.includes(o.action)&&safeName(o.name)&&(o.quantity===null||Number.isFinite(o.quantity)&&o.quantity>0&&o.quantity<=999)&&(o.unit===null||units.includes(o.unit)))}
 function canonical(o){if(o.quantity!==null&&o.quantity<1){if(o.unit==='kg')return {...o,quantity:o.quantity*1000,unit:'g'};if(o.unit==='l')return {...o,quantity:o.quantity*1000,unit:'ml'}}return o}
 function defaults(op,current,unitFor){
  if(op.action!=='list_set')return op;
  const found=current.cart.find(i=>norm(i.name)===norm(op.name));
  const unit=op.unit||found?.unit||unitFor(op.name)||'db';
  // A unit-only request starts at one when it changes an existing unit.
  const quantity=op.quantity??(found&&(!op.unit||op.unit===found.unit)?found.quantity||1:1);
  return canonical({...op,quantity,unit});
 }
 function resolve(value,items,english={},quick){
  if(!validate(value))throw Error('VOICE_INVALID_RESPONSE');
  return value.operations.map(o=>{const ranked=quick.ranked(o.name,items,english),exact=ranked.find(r=>r.exact);return {...canonical(o),name:exact?.item.name||o.name.trim(),confirmed:!!exact,suggestions:ranked.slice(0,5).map(r=>r.item.name)}});
 }
 function plan(current,operations,items,unitFor){
  if(!validate({transcript:'',clarification:'',operations}))throw Error('VOICE_INVALID_RESPONSE');
  const next=JSON.parse(JSON.stringify(current)),changes=[];
  for(const raw of operations){
   const op=defaults(raw,next,unitFor);if(op.action==='list_set'&&op.quantity!==null&&op.quantity<1)throw Error('VOICE_INVALID_QUANTITY');
   const name=op.name.trim(),known=[...items,...next.custom].find(i=>norm(i.name)===norm(name));
   if(known&&known.name!==name)throw Error('VOICE_NAME_CHANGED');
   if(op.action==='stock_add'||op.action==='stock_remove'){
    const after=op.action==='stock_add'?(next.stock[name]>0?next.stock[name]:2):0,before=Object.hasOwn(next.stock,name)?next.stock[name]:undefined;
    if((before||0)!==after)Object.defineProperty(next.stock,name,{value:after,writable:true,enumerable:true,configurable:true});
   }else{
    const found=next.cart.find(i=>norm(i.name)===norm(name));
    // Explicit quantities SET the total; repeated commands never accumulate.
    const value={...(found||{}),name,quantity:op.quantity??(found?.quantity||1),unit:op.unit||found?.unit||unitFor(name),done:false,source:found?.source||'Hang'};
    if(found)next.cart[next.cart.indexOf(found)]=value;else next.cart.push(value);
   }
   if(op.action!=='stock_remove'&&!known&&!next.custom.some(i=>norm(i.name)===norm(name)))next.custom.push({name,emoji:'🫙',category:'Saját tételek'});
  }
  // Store only changed records, never a full-state rollback.
  for(const bucket of ['stock','cart','custom']){
   const entries=s=>bucket==='stock'?Object.entries(s.stock):s[bucket].map(i=>[i.name,i]),old=new Map(entries(current)),fresh=new Map(entries(next));
   for(const key of new Set([...old.keys(),...fresh.keys()]))if(JSON.stringify(old.get(key))!==JSON.stringify(fresh.get(key)))changes.push({bucket,key,before:old.has(key)?JSON.parse(JSON.stringify(old.get(key))):undefined,after:fresh.has(key)?JSON.parse(JSON.stringify(fresh.get(key))):undefined});
  }
  return {next,changes};
 }
 function undo(current,changes){
  const next=JSON.parse(JSON.stringify(current));let skipped=0;
  for(const c of [...changes].reverse()){
   const value=c.bucket==='stock'?next.stock[c.key]:next[c.bucket].find(i=>i.name===c.key);
   if(JSON.stringify(value)!==JSON.stringify(c.after)){skipped++;continue}
   // Retain custom catalog entries; a concurrent item may still refer to them.
   if(c.bucket==='custom')continue;
   if(c.bucket==='stock'){if(c.before===undefined)delete next.stock[c.key];else Object.defineProperty(next.stock,c.key,{value:c.before,writable:true,enumerable:true,configurable:true})}
   else{next[c.bucket]=next[c.bucket].filter(i=>i.name!==c.key);if(c.before!==undefined)next[c.bucket].push(c.before)}
  }
  return {next,skipped};
 }
 return {validate,resolve,plan,undo,safeName,defaults};
})();
if(typeof module!=='undefined')module.exports=VoiceModel;
