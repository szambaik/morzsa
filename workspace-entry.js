// Manual quick entry only marks availability or ensures list membership.
// Existing quantities, recipe associations and unrelated save fields survive.
const WorkspaceEntry=(()=>{
 function collect(parts,current,items,english,matcher){
  const names=[...current];
  for(const part of parts){const text=String(part).trim().slice(0,60);if(!text)continue;
   const name=matcher.match(text,[...items,...names.map(name=>({name}))],english);
   if(!names.some(n=>matcher.norm(n)===matcher.norm(name)))names.push(name);
  }return names;
 }
 function plan(before,names,target,items,unit,norm){
  const next={...before,custom:[...before.custom],stock:{...before.stock},cart:before.cart.map(i=>({...i}))};
  const changed=[];
  for(const raw of names){
   const name=[...items,...next.custom].find(i=>norm(i.name)===norm(raw))?.name||raw;
   if(![...items,...next.custom].some(i=>norm(i.name)===norm(name)))next.custom.push({name,emoji:'🫙',category:'Saját tételek'});
   if(target==='stock'){if(!(next.stock[name]>1)){next.stock[name]=2;changed.push(name)}}
   else{const existing=next.cart.find(i=>norm(i.name)===norm(name));
    if(!existing){next.cart.push({name,quantity:1,unit:unit(name),done:false,source:'Gyors felvétel'});changed.push(name)}
    else if(existing.done){existing.done=false;changed.push(name)}
   }
  }return {next,changed};
 }
 function availability(value,known=true){return value>1?'home':value>0?'low':known?'out':'unknown'}
 function availabilityPlan(before,name,value){
  if(![0,1,2].includes(value)||typeof name!=='string'||!name.trim()||['__proto__','constructor','prototype'].includes(name))throw Error('Invalid availability');
  return {...before,stock:{...before.stock,[name]:value}};
 }
 return {collect,plan,availability,availabilityPlan};
})();
if(typeof module!=='undefined')module.exports=WorkspaceEntry;
