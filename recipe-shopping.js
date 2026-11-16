// Additive recipe provenance; shopping totals remain explicitly user controlled.
const RecipeShopping=(()=>{
 const Room=typeof RecipeRoomModel==='undefined'?require('./recipe-room-model'):RecipeRoomModel;
 const Portions=typeof RecipePortions==='undefined'?require('./recipe-portions'):RecipePortions;
 const key=r=>Room.identity(r);
 function needs(item){return (Array.isArray(item?.recipeNeeds)?item.recipeNeeds:[]).filter(n=>n&&Room.recipe(n.recipe)&&typeof n.amount==='string'&&n.amount.length<=80).slice(0,3)}
 function amount(text,defaultUnit){
  const parsed=Portions.parse(text),suffix=parsed?.suffix.replace(/^(?:kis|közepes|nagy|small|medium|large)\s+/i,'');
  const match=parsed&&/^(kg|g|ml|l|db|darab|pcs?|csomag|doboz|üveg|pohár)$/i.test(suffix)?[null,String(parsed.quantity),suffix]:null;
  if(!match)return {quantity:1,unit:defaultUnit};let quantity=Number(match[1].replace(',','.')),unit=match[2].toLowerCase();if(['darab','pc','pcs'].includes(unit))unit='db';if(unit==='db')quantity=Math.ceil(quantity);if(quantity>999&&unit==='g'){quantity/=1000;unit='kg'}if(quantity>999&&unit==='ml'){quantity/=1000;unit='l'}if(quantity<1&&unit==='kg'){quantity*=1000;unit='g'}if(quantity<1&&unit==='l'){quantity*=1000;unit='ml'}return quantity>=1&&quantity<=999?{quantity,unit}:{quantity:1,unit:defaultUnit};
 }
 function plan(source,recipe,resolve,unitFor,names=null,portions=null){
  const clean=Room.recipe(recipe);if(!clean)throw Error('INVALID_RECIPE');
  const next={...source,cart:source.cart.map(i=>({...i})),custom:[...source.custom]},selected=names&&new Set(names),seen=new Set();let added=0,linked=0;
  for(const ingredient of Portions.view(clean,portions).ingredients){const name=resolve(ingredient.name);if(seen.has(name)||(selected?!selected.has(name):source.stock[name]>0))continue;seen.add(name);
   let item=next.cart.find(i=>i.name===name);const ref={recipe:clean,amount:ingredient.amount,...(portions?{portions:Portions.selection(clean,portions)}:{})};
   if(item){const refs=needs(item);if(refs.some(n=>key(n.recipe)===key(clean)))continue;if(refs.length>=3)throw Error('RECIPE_LINK_LIMIT');item.recipeNeeds=[...refs,ref];linked++}
   else{item={name,...amount(ingredient.amount,unitFor(name)),source:clean.title,done:false,recipeNeeds:[ref]};next.cart.push(item);added++}
  }
  return {next,added,linked};
 }
 function purchase(source,ingredient,resolve,unitFor){
  const name=resolve(ingredient.name),item=source.cart.find(i=>i.name===name),parsed=Portions.parse(ingredient.amount),supported=parsed&&/^(?:(?:kis|közepes|nagy|small|medium|large)\s+)?(?:kg|g|ml|l|db|darab|pcs?|csomag|doboz|üveg|pohár)$/i.test(parsed.suffix);
  const value=item?{quantity:item.quantity||1,unit:item.unit||unitFor(name)}:amount(ingredient.amount,unitFor(name));
  return {name,...value,reason:item?'kept':!supported?'standard':value.unit==='db'&&parsed.quantity!==value.quantity?'rounded':'exact'};
 }
 return {key,needs,amount,plan,purchase};
})();
if(typeof module!=='undefined')module.exports=RecipeShopping;
