// Deterministic product identity. Existing names are retained until an explicit
// consolidation; dietary variants and unknown custom names stay separate.
const IngredientModel=(()=>{
 const Quick=typeof QuickEntry==='undefined'?require('./quick-entry'):QuickEntry;
 const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>[k,stable(value[k])])):value;
 // PostgreSQL jsonb can reorder nested object keys. Equality is structural.
 const equal=(a,b)=>JSON.stringify(stable(a??null))===JSON.stringify(stable(b??null));
 const units={kg:['mass',1000],g:['mass',1],l:['volume',1000],ml:['volume',1],db:['count',1]};
 function create(items,english={}){
  const identity=Quick.identity(items,english),categories=new Map(items.map(i=>[identity.key(i.name),i.category]));
  function category(name){
   const known=categories.get(identity.key(name));if(known)return known;
   const n=' '+Quick.norm(name)+' ';
   const hints=[['Tejtermék és tojás',/\b(?:tej|joghurt|kefir|tejfol|sajt|turo|vaj|tojas|skyr)\b/],['Zöldségek',/\b(?:paradicsom|burgonya|krumpli|cukkini|uborka|hagyma|brokkoli|sargarepa)\b/],['Gyümölcsök',/\b(?:alma|banan|citrom|narancs|korte|eper|mango)\b/],['Hús és felvágott',/\b(?:csirkemell|csirkecomb|pulykamell|daralt hus|sonka|kolbasz|bacon)\b/],['Rizs és tészta',/\b(?:rizs|teszta|spagetti|penne|bulgur|kuszkusz)\b/],['Pékáru',/\b(?:kenyer|zsemle|kifli|bagett|kalacs)\b/],['Sütés és édesség',/\b(?:liszt|cukor|sutopor|szodabikarbona|kakaopor)\b/],['Italok',/\b(?:asvanyviz|udito|gyumolcsle|kave|tea)\b/]];
   // A category hint never changes product identity, e.g. branded or special milk.
   return hints.find(([,rule])=>rule.test(n))?.[0]||'Saját tételek';
  }
  function duplicates(source,bucket){
   const groups=new Map(),rows=bucket==='stock'?Object.keys(source.stock).map(name=>({name,value:source.stock[name]})):source.cart;
   for(const row of rows){const key=identity.key(row.name);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}
   return [...groups.values()].filter(g=>g.length>1).map(rows=>({name:identity.resolve(rows[0].name),rows}));
  }
  function consolidate(source,bucket,{unitFor=()=> 'db'}={}){
   const changes=[],merged=[],skipped=[];
   for(const group of duplicates(source,bucket)){
    const {name,rows}=group;if(new Set(rows.map(r=>r.name)).size!==rows.length){skipped.push(group);continue}if(['__proto__','constructor','prototype'].includes(name)){skipped.push(group);continue}
    let value;
    if(bucket==='stock'){
     if(!rows.every(r=>Number.isFinite(r.value)&&r.value>=0)){skipped.push(group);continue}
     value=Math.max(...rows.map(r=>r.value));
    }else{
     const first=rows.find(r=>r.name===name)||rows[0],metadata=row=>Object.fromEntries(Object.keys(row).filter(k=>!['name','quantity','unit','source','addedBy','addedAt','ingredientAliases'].includes(k)).sort().map(k=>[k,row[k]]));
     let firstUnit=first.unit||unitFor(first.name);const base=units[firstUnit]||[firstUnit,1];
     if(rows.some(r=>!Number.isFinite(r.quantity??1)||(r.quantity??1)<1||(r.quantity??1)>999)){skipped.push(group);continue}
     if(rows.some(r=>!equal(metadata(r),metadata(first))||(units[r.unit||unitFor(r.name)]||[r.unit||unitFor(r.name),1])[0]!==base[0])){skipped.push(group);continue}
     let total=rows.reduce((n,r)=>n+(r.quantity??1)*(units[r.unit||unitFor(r.name)]?.[1]||1),0)/base[1];
     if(total>=1000&&['g','ml'].includes(firstUnit)){total/=1000;firstUnit=firstUnit==='g'?'kg':'l'}
     if(total<1&&['kg','l'].includes(firstUnit)){total*=1000;firstUnit=firstUnit==='kg'?'g':'ml'}
     if(!Number.isFinite(total)||total<1||total>999){skipped.push(group);continue}
     // Separate additions naturally have different actors/timestamps/sources.
     // Retain the canonical row and the original provenance of every alias.
     const origins=rows.flatMap(row=>[...(Array.isArray(row.ingredientAliases)?row.ingredientAliases:[]),Object.fromEntries(['name','quantity','unit','source','addedBy','addedAt'].filter(k=>row[k]!==undefined).map(k=>[k,row[k]]))]);
     const unique=origins.filter((o,i)=>origins.findIndex(x=>equal(x,o))===i);
     if(unique.length>100){skipped.push(group);continue}
     value={...first,name,quantity:Math.round(total*1e6)/1e6,unit:firstUnit,ingredientAliases:unique};
    }
    const before=bucket==='stock'?source.stock[name]:source.cart.find(r=>r.name===name);
    for(const row of rows)if(row.name!==name)changes.push({bucket,key:row.name,before:bucket==='stock'?row.value:row,after:null});
    changes.push({bucket,key:name,before:before??null,after:value});merged.push({...group,value});
   }
   return {bucket,changes,merged,skipped};
  }
  function apply(source,plan){
   if(plan.changes.some(c=>!equal(c.bucket==='stock'?source.stock[c.key]:source.cart.find(r=>r.name===c.key),c.before)))return null;
   const next={...source,stock:{...source.stock},cart:source.cart.map(r=>({...r}))};
   for(const c of plan.changes){if(c.bucket==='stock'){if(c.after===null)delete next.stock[c.key];else Object.defineProperty(next.stock,c.key,{value:c.after,writable:true,enumerable:true,configurable:true})}else{next.cart=next.cart.filter(r=>r.name!==c.key);if(c.after!==null)next.cart.push({...c.after})}}
   return next;
  }
  return {...identity,category,duplicates,consolidate,apply};
 }
 return {create};
})();
if(typeof module!=='undefined')module.exports=IngredientModel;
