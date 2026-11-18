const QuickEntry = (() => {
 const normalized=new Map();
 const norm=s=>{if(normalized.has(s))return normalized.get(s);const value=s.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ');if(normalized.size>=4096)normalized.clear();normalized.set(s,value);return value};
 const aliases={burgonya:'Krumpli',burgonyak:'Krumpli',krumplik:'Krumpli',potatoes:'Krumpli',paradicsomok:'Paradicsom',tomatoes:'Paradicsom',tojasok:'Tojás',eggs:'Tojás',voroshagyma:'Hagyma','voros hagyma':'Hagyma',onions:'Hagyma',apples:'Alma',bananas:'Banán',carrots:'Sárgarépa',sargarepak:'Sárgarépa',padlizsanok:'Padlizsán',eggplant:'Padlizsán',eggplants:'Padlizsán',zucchini:'Cukkini',courgettes:'Cukkini',aubergines:'Padlizsán',mushrooms:'Gomba',gombak:'Gomba',oatmilk:'Zabital','oat milk':'Zabital',zabtej:'Zabital','soy milk':'Szójaital',szojatej:'Szójaital','almond milk':'Mandulaital',mandulatej:'Mandulaital','green peas':'Borsó','green beans':'Zöldbab'};
 // Only explicit aliases and exact catalog translations define identity. Fuzzy
 // suggestions must never merge two existing household records.
 function identity(items,english={}){
  const exact=new Map(),names=new Set(items.map(i=>i.name));
  for(const item of items)for(const name of [item.name,english[item.name]||'']){const key=norm(name);if(key&&!exact.has(key))exact.set(key,item.name)}
  const resolve=text=>{const value=String(text??'').trim(),q=norm(value);return names.has(aliases[q])?aliases[q]:exact.get(q)||value};
  const key=text=>norm(resolve(text));
  const target=(text,existing=[])=>{const name=resolve(text),wanted=key(name);return existing.find(n=>n===name)||existing.find(n=>key(n)===wanted)||name};
  return {resolve,key,target};
 }
 function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]!==b[j-1]));row=next}return row[b.length]}
 function ranked(text,items,english={}){const q=norm(text);if(!q)return [];return items.map(item=>{const names=[norm(item.name),norm(english[item.name]||'')].filter(Boolean);const exact=names.includes(q)||aliases[q]===item.name;const d=names.includes(q)?0:Math.min(...names.map(n=>distance(q,n)));const close=q.length>=4&&d<=(q.length>=8?2:1);return {item,exact,close,d,score:exact?0:names.some(n=>n.startsWith(q))?1:names.some(n=>n.includes(q))?2:close?3:9}}).filter(x=>x.score<9).sort((a,b)=>a.score-b.score||a.d-b.d)}
 function match(text,items,english={}){const q=norm(text),alias=aliases[q]&&items.find(i=>i.name===aliases[q]);if(alias)return alias.name;const direct=items.find(i=>norm(i.name)===q||english[i.name]&&norm(english[i.name])===q);if(direct)return direct.name;const results=ranked(text,items,english),exact=results.find(x=>x.exact);if(exact)return exact.item.name;const close=results.filter(x=>x.close).sort((a,b)=>a.d-b.d);return close.length&&(!close[1]||close[0].d<close[1].d)?close[0].item.name:text.trim()}
 // A render owns this index, so edits or household changes cannot leave stale matches.
 function matcher(items,english={}){
  const exact=new Map(),names=new Set(),answers=new Map();
  for(const item of items){names.add(item.name);for(const name of [item.name,english[item.name]||'']){const key=norm(name);if(key&&!exact.has(key))exact.set(key,item.name)}}
  return text=>{const q=norm(text);if(aliases[q]&&names.has(aliases[q]))return aliases[q];if(exact.has(q))return exact.get(q);if(!answers.has(text))answers.set(text,match(text,items,english));return answers.get(text)};
 }
 return {norm,ranked,match,matcher,identity};
})();
if(typeof module!=='undefined')module.exports=QuickEntry;
