// Pure shared-state conversion and per-record optimistic concurrency diff.
const HouseholdModel={
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
