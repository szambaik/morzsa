// Pure shared-state conversion and per-record optimistic concurrency diff.
const HouseholdModel={
 productKey(name){return String(name).normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('hu')},
 // Store field-level shopping intent, so a check never overwrites a partner's quantity.
 mergeRecipeNeeds(before=[],added=[]){const result=[];for(const n of [...before,...added])if(n?.recipe&&!result.some(x=>JSON.stringify([x.recipe.title,x.recipe.ingredients,x.recipe.steps])===JSON.stringify([n.recipe.title,n.recipe.ingredients,n.recipe.steps])))result.push(n);return result.slice(0,3)},
 cartIntent(before,next){
  const old=new Map(before.cart.map(x=>[this.productKey(x.name),x])),fresh=new Map(next.cart.map(x=>[this.productKey(x.name),x])),cart=[];
  for(const [key,item] of old)if(!fresh.has(key))cart.push({name:item.name,remove:true});
  for(const [key,item] of fresh){const previous=old.get(key),fields={};for(const field of Object.keys(item))if(field!=='name'&&JSON.stringify(item[field])!==JSON.stringify(previous?.[field]))fields[field]=item[field];if(!previous||Object.keys(fields).length)cart.push({name:previous?.name||item.name,create:!previous,fields})}
  return {cart,custom:next.custom.filter(x=>!before.custom.some(y=>this.productKey(y.name)===this.productKey(x.name)))};
 },
 applyCartIntents(base,intents,onConflict){
  const next={...base,cart:base.cart.map(x=>({...x})),custom:[...base.custom]};
  for(const intent of intents){
   for(const op of intent.cart){const i=next.cart.findIndex(x=>this.productKey(x.name)===this.productKey(op.name));if(op.when&&(i<0||!Object.entries(op.when).every(([key,value])=>JSON.stringify(next.cart[i][key]??null)===JSON.stringify(value??null)))){onConflict?.(op.name,intent);continue;}if(op.create&&i>=0){if(op.fields.recipeNeeds)next.cart[i]={...next.cart[i],recipeNeeds:this.mergeRecipeNeeds(next.cart[i].recipeNeeds,op.fields.recipeNeeds)};continue;}if(op.remove){if(i>=0)next.cart.splice(i,1)}else if(i>=0)next.cart[i]={...next.cart[i],...op.fields,...(op.fields.recipeNeeds?{recipeNeeds:this.mergeRecipeNeeds(next.cart[i].recipeNeeds,op.fields.recipeNeeds)}:{}),name:next.cart[i].name};else if(op.create)next.cart.push({...op.fields,name:op.name.trim()})}
   for(const item of intent.custom)if(!next.custom.some(x=>this.productKey(x.name)===this.productKey(item.name)))next.custom.push(item);
  }return next;
 },
 // Additive pantry-only import; keep the older full import contract unchanged.
 pantryImportPlan(source,target,catalog=[],identify=null){
  const next=JSON.parse(JSON.stringify(target)),added=[],kept=[];
  const norm=identify||(typeof productIdentity==='undefined'?name=>name.normalize("NFC").trim().toLocaleLowerCase("hu"):productIdentity.key);
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
