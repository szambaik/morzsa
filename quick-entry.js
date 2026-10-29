const QuickEntry = (() => {
 const norm=s=>s.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ');
 const aliases={burgonya:'Krumpli',krumplik:'Krumpli',paradicsomok:'Paradicsom',tojasok:'Tojás',potatoes:'Krumpli',eggs:'Tojás',tomatoes:'Paradicsom',voroshagyma:'Hagyma'};
 function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]!==b[j-1]));row=next}return row[b.length]}
 function ranked(text,items,english={}){const q=norm(text);if(!q)return [];return items.map(item=>{const names=[norm(item.name),norm(english[item.name]||'')].filter(Boolean);const exact=names.includes(q)||aliases[q]===item.name;const d=Math.min(...names.map(n=>distance(q,n)));const close=q.length>=4&&d<=(q.length>=8?2:1);return {item,exact,close,d,score:exact?0:names.some(n=>n.startsWith(q))?1:names.some(n=>n.includes(q))?2:close?3:9}}).filter(x=>x.score<9).sort((a,b)=>a.score-b.score||a.d-b.d)}
 function match(text,items,english){const results=ranked(text,items,english),exact=results.find(x=>x.exact);if(exact)return exact.item.name;const close=results.filter(x=>x.close).sort((a,b)=>a.d-b.d);return close.length&&(!close[1]||close[0].d<close[1].d)?close[0].item.name:text.trim()}
 return {norm,ranked,match};
})();
if(typeof module!=='undefined')module.exports=QuickEntry;
