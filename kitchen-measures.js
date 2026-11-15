// Presentation-only approximations. Never change saved recipe or shopping amounts.
const KitchenMeasures=(()=>{
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const densities=[
  {names:['liszt','finomliszt','buzaliszt','wheat flour','plain flour','all-purpose flour','flour'],cup:130,spoon:8,loose:true},
  {names:['cukor','kristalycukor','sugar','granulated sugar'],cup:200,spoon:12},
  {names:['rizs','feher rizs','rice','white rice'],cup:200,spoon:12},
  {names:['zabpehely','oats','rolled oats'],cup:90,spoon:5},
  {names:['kakaopor','cukrozatlan kakaopor','cocoa powder','unsweetened cocoa powder'],cup:100,spoon:6,loose:true}
 ];
 const number=(n,en)=>String(n).replace('.',en?'.':',');
 function volume(n,cup,spoon,en){
  if(n>=cup/2){
   const quarters=Math.round(n/cup*4);
   const whole=Math.floor(quarters/4),fraction=['','¼','½','¾'][quarters%4];
   return (whole?whole+(fraction?' ':''):'')+fraction+(en?' mug'+(quarters>4?'s':''):' bögre');
  }
  const spoons=Math.round(n/spoon*2)/2;
  if(spoons<0.5)return '';
  return number(spoons,en)+(en?' level tablespoon'+(spoons>1?'s':''):' csapott evőkanál');
 }
 function hint(name,amount,language='hu'){
  const en=language==='en',match=normalize(amount).match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)$/);
  if(!match)return '';
  let n=Number(match[1].replace(',','.'));if(!Number.isFinite(n)||n<=0)return '';
  const unit=match[2];if(unit==='kg'||unit==='l')n*=1000;
  let measure='',extra='';
  if(unit==='ml'||unit==='l'){
   if(n<7.5){const spoons=Math.round(n/5*2)/2;if(spoons<0.5)return '';measure=number(spoons,en)+(en?' teaspoon'+(spoons>1?'s':''):' teáskanál')}
   else measure=volume(n,250,15,en);
  }else{
   const density=densities.find(d=>d.names.includes(normalize(name)));
   if(!density)return '';
   measure=volume(n,density.cup,density.spoon,en);
   if(density.loose)extra=en?' · loosely filled, levelled':' · lazán töltve, lesimítva';
  }
  return measure?(en?'≈ ':'Kb. ')+measure+extra:'';
 }
 const enabled=()=>{try{return localStorage.getItem('morzsa-kitchen-measures')==='on'}catch{return false}};
 function mount(root,recipe,language='hu'){
  const list=root.querySelector('.recipe-ingredient-list');if(!list)return;
  const en=language==='en',toggle=document.createElement('button'),note=document.createElement('p');
  toggle.type='button';toggle.className='recipe-measures-toggle';toggle.textContent=en?'No scale or measuring jug?':'Mérleg nélkül';
  note.className='recipe-measures-note';note.id='recipe-measures-'+(root.id||'reading');toggle.setAttribute('aria-controls',note.id);
  note.textContent=en?'Approximate measures: mug = 250 ml, tablespoon = 15 ml, teaspoon = 5 ml. Household sizes vary. Dry ingredients use level spoons. Take extra care with baking, salt and leavening; where no hint appears, ask Morzsa for help.':'Közelítő mértékek: bögre = 250 ml, evőkanál = 15 ml, teáskanál = 5 ml. Az otthoni méretek eltérhetnek. A száraz hozzávalóknál csapott kanállal számolunk. Sütésnél, sónál és kelesztőknél különösen figyelj; ahol nincs közelítés, kérdezz Morzsától.';
  list.before(toggle,note);
  const hints=[];list.querySelectorAll('.recipe-ingredient-row').forEach((row,i)=>{
   const ingredient=recipe.ingredients[i],text=hint(ingredient.name,ingredient.amount,language);if(!text)return;
   const small=document.createElement('span');small.className='recipe-measure-hint';small.textContent=text;row.querySelector('.recipe-needed').after(small);hints.push(small);
  });
  let active=enabled();
  const paint=()=>{toggle.setAttribute('aria-pressed',String(active));note.hidden=!active;for(const element of hints)element.hidden=!active};
  toggle.onclick=()=>{active=!active;try{localStorage.setItem('morzsa-kitchen-measures',active?'on':'off')}catch{}paint()};paint();
 }
 return {hint,mount,enabled};
})();
if(typeof window!=='undefined')window.KitchenMeasures=KitchenMeasures;
if(typeof module!=='undefined')module.exports=KitchenMeasures;
