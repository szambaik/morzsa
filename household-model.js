// Pure shared-state conversion and per-record optimistic concurrency diff.
const HouseholdModel={
 // Additive pantry-only import; keep the older full import contract unchanged.
 pantryImportPlan(source,target,catalog=[]){
  const next=JSON.parse(JSON.stringify(target)),added=[],kept=[];
  const norm=name=>name.normalize("NFC").trim().toLocaleLowerCase("hu");
  const stockNames=new Map(Object.keys(next.stock).map(name=>[norm(name),name]));
  const customNames=new Map(next.custom.map(item=>[norm(item.name),item.name]));
  const catalogNames=new Map(catalog.map(item=>[norm(item.name),item.name]));
  const sourceCustom=Array.isArray(source?.custom)?source.custom:[];
  for(const [raw,value] of Object.entries(source?.stock||{})){
   if(!(Number(value)>0)||!raw.trim())continue;
   const key=norm(raw),name=stockNames.get(key)||catalogNames.get(key)||customNames.get(key)||raw.trim();
   if(next.stock[name]>0)kept.push(name);
   else{Object.defineProperty(next.stock,name,{value:2,writable:true,enumerable:true,configurable:true});added.push(name)}
   stockNames.set(key,name);
   if(!catalogNames.has(key)&&!customNames.has(key)){
    const original=sourceCustom.find(item=>typeof item?.name==="string"&&norm(item.name)===key);
    next.custom.push({...original,name,category:"Saját tételek",emoji:original?.emoji||"🫙"});customNames.set(key,name);
   }
  }
  return {next,added,kept};
 },
 importPlan(source,target){
  const next=JSON.parse(JSON.stringify(target)),added={stock:[],cart:[],custom:[]},kept={stock:[],cart:[],custom:[]};
  for(const [name,value] of Object.entries(source.stock))if(value>0){if(Object.hasOwn(next.stock,name))kept.stock.push(name);else{next.stock[name]=value;added.stock.push(name)}}
  for(const bucket of ['cart','custom'])for(const item of source[bucket]){if(next[bucket].some(x=>x.name.toLocaleLowerCase('hu')===item.name.toLocaleLowerCase('hu')))kept[bucket].push(item.name);else{next[bucket].push(JSON.parse(JSON.stringify(item)));added[bucket].push(item.name)}}
  return {next,added,kept};
 },
 encode(s){const out=new Map();for(const [name,value] of Object.entries(s.stock))out.set('stock:'+name,{bucket:'stock',key:name,value});for(const bucket of ['cart','custom','history'])for(const value of s[bucket]){const key=bucket==='history'?value.id:value.name;out.set(bucket+':'+key,{bucket,key,value})}return out},
 diff(rows,s){const old=new Map(rows.map(r=>[r.bucket+':'+r.key,r])),next=this.encode(s),changes=[];for(const key of new Set([...old.keys(),...next.keys()])){const a=old.get(key),b=next.get(key);if(JSON.stringify(a?.value??null)!==JSON.stringify(b?.value??null)){const base=b||a;changes.push({bucket:base.bucket,key:base.key,value:b?.value??null,expected:a?.revision||0})}}return changes},
 decode(rows,personal){const next={...personal,stock:{},cart:[],custom:[],history:[]};for(const r of rows){if(r.value===null)continue;if(r.bucket==='stock')next.stock[r.key]=r.value;else if(['cart','custom','history'].includes(r.bucket))next[r.bucket].push(r.value)}next.history.sort((a,b)=>b.date.localeCompare(a.date));return next}
};
if(typeof module!=='undefined')module.exports=HouseholdModel;
