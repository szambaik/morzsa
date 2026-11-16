// Pantry setup is a draft. Only the existing save path may commit it.
const OnboardingModel=(()=>{
 const limit=60,norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const packs=[
  {id:'spices',hu:'Alap fűszerek',en:'Everyday spices',art:'Só',names:['Só','Bors','Pirospaprika','Oregánó','Bazsalikom','Fahéj']},
  {id:'cupboard',hu:'Kamra alapok',en:'Cupboard staples',art:'Rizs',names:['Rizs','Tészta','Liszt','Olaj','Cukor','Paradicsomkonzerv']},
  {id:'breakfast',hu:'Reggelihez',en:'Breakfast basics',art:'Tojás',names:['Tej','Tojás','Vaj','Kenyér','Zabpehely','Kávé']}
 ];
 const safe=n=>typeof n==='string'&&n.trim()&&n.length<=80&&!/[\u0000-\u001f]/.test(n)&&!['__proto__','prototype','constructor'].includes(n.trim());
 function selection(current,add=[],remove=[]){
  const omitted=new Set(remove.filter(safe).map(norm)),names=new Map();
  for(const n of [...current,...add])if(safe(n)&&!omitted.has(norm(n))&&!names.has(norm(n)))names.set(norm(n),n.trim());
  return [...names.values()].slice(0,limit);
 }
 function fromOperations(current,operations){
  let names=selection(current),ignored=0;
  for(const op of operations){if(op.action==='stock_add')names=selection(names,[op.name]);else if(op.action==='stock_remove')names=selection(names,[],[op.name]);else ignored++}
  return {names,ignored};
 }
 return {limit,packs,selection,fromOperations};
})();
if(typeof module!=='undefined')module.exports=OnboardingModel;
