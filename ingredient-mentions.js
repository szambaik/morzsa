// Conservative word/phrase matching. Keep original message text and storage intact.
const IngredientMentions=(()=>{
 const norm=s=>s.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const forms={Tej:['tejet','tejjel','tejben','tejből'],Tojás:['tojást','tojások','tojásokat','tojással','tojásból'],Liszt:['lisztet','liszttel','lisztből'],Vaj:['vajat','vajjal','vajból'],Só:['sót','sóval'],Rizs:['rizst','rizzsel','rizsből'],Krumpli:['burgonya','burgonyát','krumplit','krumplival','burgonyával','potatoes'],Hagyma:['hagymát','hagymával','vöröshagyma'],Fokhagyma:['fokhagymát','fokhagymával'],Paradicsom:['paradicsomot','paradicsommal','paradicsomok','tomatoes'],Paprika:['paprikát','paprikával'],Alma:['almát','almával'],Banán:['banánt','banánnal'],Olaj:['olajat','olajjal'],Cukor:['cukrot','cukorral'],Sajt:['sajtot','sajttal'],Tejföl:['tejfölt','tejföllel'],Tejszín:['tejszínt','tejszínnel'],Joghurt:['joghurtot','joghurttal'],Csirkemell:['csirkemellet','csirkemellel'],Tészta:['tésztát','tésztával'],Kenyér:['kenyeret','kenyérrel'],Gomba:['gombát','gombával']};
 function build(items,english={}){
  const names=new Map(),ambiguous=new Set();let max=1;
  const add=(text,name)=>{const words=norm(text).match(/[\p{L}\p{M}\p{N}]+/gu);if(!words||words.length>6)return;const key=words.join(' ');if(names.has(key)&&names.get(key)!==name)ambiguous.add(key);else names.set(key,name);max=Math.max(max,words.length)};
  for(const item of items){add(item.name,item.name);if(english[item.name])add(english[item.name],item.name)}
  // Canonical catalog names win; ambiguous aliases are not made interactive.
  for(const item of items){for(const form of forms[item.name]||[])if(!names.has(norm(form)))add(form,item.name);const en=english[item.name];if(en&&!/s$/i.test(en)&&!names.has(norm(en+'s')))add(en+'s',item.name)}
  for(const key of ambiguous)names.delete(key);
  return {names,max};
 }
 function split(text,index){
  const words=[...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)],parts=[];let cursor=0;
  for(let i=0;i<words.length;){let found=null;
   for(let size=Math.min(index.max,words.length-i);size>=1;size--){const last=words[i+size-1],end=last.index+last[0].length,piece=text.slice(words[i].index,end);if(!/^[\p{L}\p{M}\p{N}\s-]+$/u.test(piece))continue;const name=index.names.get(norm(piece).replace(/[\s-]+/g,' '));if(name){found={name,start:words[i].index,end,size};break}}
   if(!found){i++;continue}if(found.start>cursor)parts.push({text:text.slice(cursor,found.start)});parts.push({text:text.slice(found.start,found.end),name:found.name});cursor=found.end;i+=found.size;
  }
  if(cursor<text.length)parts.push({text:text.slice(cursor)});return parts;
 }
 return {build,split};
})();
if(typeof module!=='undefined')module.exports=IngredientMentions;
