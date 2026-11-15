// Selected portions are cooking-session settings, not new recipe/image identities.
const RecipePortions=(()=>{
 const valid=n=>Number.isInteger(n)&&n>=1&&n<=24;
 function base(r){
  if(valid(r.servings))return {value:r.servings,source:'recipe'};
  const description=String(r.summary||''),numeric=description.match(/\b(\d{1,2})\s*(?:főre|személyre|személynek|adag(?:ra)?|people|persons?|servings?|portions?)\b/i)||description.match(/\b(?:for|serves)\s+(\d{1,2})\b/i);
  if(numeric&&valid(Number(numeric[1])))return {value:Number(numeric[1]),source:'description'};
  if(/\bkét\s+(?:főre|személyre|személynek|adagra)\b/i.test(description))return {value:2,source:'description'};
  return {value:null,source:'unknown'};
 }
 function selection(r,value){const original=base(r).value,b=original||value?.base;return valid(b)?{base:b,target:valid(value?.target)?value.target:b}:null}
 function parse(text){
  const s=String(text).trim(),m=s.match(/^(\d+(?:[.,]\d+)?|[¼½¾]|fél|egy|két|három|one|half|two|three)\s+(.+)$/i);if(!m)return null;
  const words={'¼':.25,'½':.5,'¾':.75,fél:.5,egy:1,két:2,három:3,one:1,half:.5,two:2,three:3},n=words[m[1].toLowerCase()]??Number(m[1].replace(',','.'));
  if(!Number.isFinite(n)||n<=0)return null;
  const suffix=m[2].trim();
  if(!/^(?:(?:kis|közepes|nagy|small|medium|large)\s+)?(?:g|kg|ml|l|db|darab|pcs?|csomag|doboz|üveg|pohár|bögre|evőkanál|teáskanál|ek|tk|tablespoons?|teaspoons?|tbsp|tsp|cups?|mugs?|csipet|pinch(?:es)?|gerezd|cloves?)$/i.test(suffix))return null;
  return {quantity:n,suffix};
 }
 function amount(text,factor){const p=parse(text);if(!p||factor===1)return text;const n=Math.round(p.quantity*factor*100)/100;return String(n).replace('.',',')+' '+p.suffix}
 function view(r,value){const selected=selection(r,value);if(!selected)return r;return {...r,servings:selected.target,summary:r.summary.replace(/(?:\b\d{1,2}|\bkét)\s+(?=(?:főre|személyre|személynek|adag(?:ra)?|people|persons?|servings?|portions?)\b)/gi,selected.target+' ').slice(0,400),ingredients:r.ingredients.map(i=>({...i,amount:amount(i.amount,selected.target/selected.base)}))}}
 function controls(r,value,language='hu',disabled=false){
  const en=language==='en',selected=selection(r,value),origin=base(r);
  const choose='<select data-portions-base aria-label="'+(en?'Original recipe portions':'Az alaprecept adagszáma')+'" '+(disabled?'disabled':'')+'><option value="">'+(en?'Original portions…':'Alaprecept adagja…')+'</option>'+Array.from({length:24},(_,i)=>'<option value="'+(i+1)+'" '+(selected?.base===i+1?'selected':'')+'>'+(i+1)+(en?' portions':' adag')+'</option>').join('')+'</select>';
  return '<div class="recipe-portions" role="group" aria-label="'+(en?'Recipe portions':'Recept adagok')+'"><div class="recipe-portions-heading"><strong>'+(en?'How many portions?':'Hány adagot készítsünk?')+'</strong>'+(origin.source==='unknown'?choose:origin.source==='description'?'<small>'+(en?'Original portions from the description':'Alap adagszám a leírásból')+'</small>':'')+'</div><div class="recipe-portions-stepper"><button data-portions-delta="-1" aria-label="'+(en?'One fewer portion':'Eggyel kevesebb adag')+'" '+(disabled||!selected||selected.target===1?'disabled':'')+'>−</button><input data-portions-target type="number" min="1" max="24" step="1" inputmode="numeric" aria-label="'+(en?'Number of portions':'Adagok száma')+'" value="'+(selected?.target||'')+'" '+(disabled||!selected?'disabled':'')+'><span>'+(en?'portions':'adag')+'</span><button data-portions-delta="1" aria-label="'+(en?'One more portion':'Eggyel több adag')+'" '+(disabled||!selected||selected.target===24?'disabled':'')+'>+</button></div></div>'+(origin.source==='unknown'&&!selected?'<p class="recipe-portions-note">'+(en?'This older recipe has no saved serving count. Set its original portions before scaling.':'Ennél a régi receptnél nincs mentett adagszám. Állítsd be az alaprecept adagját az átszámításhoz.')+'</p>':'')+(selected&&selected.target!==selected.base?'<p class="recipe-portions-note">'+(en?'Ingredient amounts are scaled. The original method, oven temperature and timing stay the same; check the pan size when baking. Existing shopping quantities stay as entered.':'A hozzávalók átszámolva. A leírás az alaprecepté; a hőfok és az idő nem szorzódik. Sütésnél ellenőrizd a forma méretét. A már listára tett mennyiségek megmaradnak.')+'</p>':'');
 }
 function bind(root,r,value,onChange){
  const current=()=>selection(r,value);
  root.querySelector('[data-portions-base]')?.addEventListener('change',e=>{const n=Number(e.target.value);if(valid(n))onChange({base:n,target:n})});
  root.querySelector('[data-portions-target]')?.addEventListener('change',e=>{const s=current(),n=Number(e.target.value);if(s&&valid(n))onChange({...s,target:n});else e.target.value=s?.target||''});
  root.querySelectorAll('[data-portions-delta]').forEach(b=>b.onclick=()=>{const s=current(),n=s?.target+Number(b.dataset.portionsDelta);if(s&&valid(n))onChange({...s,target:n})});
 }
 return {valid,base,selection,parse,amount,view,controls,bind};
})();
if(typeof window!=='undefined')window.RecipePortions=RecipePortions;
if(typeof module!=='undefined')module.exports=RecipePortions;
