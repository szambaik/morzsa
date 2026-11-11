// Additive recipe provenance; shopping totals remain explicitly user controlled.
const RecipeShopping=(()=>{
 const Room=typeof RecipeRoomModel==='undefined'?require('./recipe-room-model'):RecipeRoomModel;
 const key=r=>JSON.stringify([r.title,r.ingredients,r.steps]);
 function needs(item){return (Array.isArray(item?.recipeNeeds)?item.recipeNeeds:[]).filter(n=>n&&Room.recipe(n.recipe)&&typeof n.amount==='string'&&n.amount.length<=80).slice(0,3)}
 function amount(text,defaultUnit){
  const match=/^\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|db|darab|pcs?|csomag|doboz|üveg|pohár)\s*$/i.exec(text);
  if(!match)return {quantity:1,unit:defaultUnit};let quantity=Number(match[1].replace(',','.')),unit=match[2].toLowerCase();if(['darab','pc','pcs'].includes(unit))unit='db';if(quantity<1&&unit==='kg'){quantity*=1000;unit='g'}if(quantity<1&&unit==='l'){quantity*=1000;unit='ml'}return quantity>=1&&quantity<=999?{quantity,unit}:{quantity:1,unit:defaultUnit};
 }
 function plan(source,recipe,resolve,unitFor,names=null){
  const clean=Room.recipe(recipe);if(!clean)throw Error('INVALID_RECIPE');
  const next={...source,cart:source.cart.map(i=>({...i})),custom:[...source.custom]},selected=names&&new Set(names),seen=new Set();let added=0,linked=0;
  for(const ingredient of clean.ingredients){const name=resolve(ingredient.name);if(seen.has(name)||(selected?!selected.has(name):source.stock[name]>0))continue;seen.add(name);
   let item=next.cart.find(i=>i.name===name);const ref={recipe:clean,amount:ingredient.amount};
   if(item){const refs=needs(item);if(refs.some(n=>key(n.recipe)===key(clean)))continue;if(refs.length>=3)throw Error('RECIPE_LINK_LIMIT');item.recipeNeeds=[...refs,ref];linked++}
   else{item={name,...amount(ingredient.amount,unitFor(name)),source:clean.title,done:false,recipeNeeds:[ref]};next.cart.push(item);added++}
  }
  return {next,added,linked};
 }
 return {key,needs,amount,plan};
})();
if(typeof module!=='undefined')module.exports=RecipeShopping;
