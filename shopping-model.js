// Purchase records keep the existing shape so old clients and archives remain readable.
const ShoppingModel={
 complete(source,{includeUnchecked,id,date,unitFor,categoryFor,knownNames=[]}){
  const bought=item=>!!item.done||(includeUnchecked&&categoryFor(item.name)!=='Saját tételek');
  const purchased=source.cart.filter(bought);
  if(!purchased.length)return null;
  const next=JSON.parse(JSON.stringify(source));
  const items=purchased.map(item=>({...item,done:true,quantity:item.quantity||1,unit:item.unit||unitFor(item.name),category:categoryFor(item.name)}));
  const recipeSnapshots=[];
  for(const item of items)if(Array.isArray(item.recipeNeeds))item.recipeNeeds=item.recipeNeeds.map(n=>{if(!n?.recipe)return n;const encoded=JSON.stringify(n.recipe);let index=recipeSnapshots.findIndex(r=>JSON.stringify(r)===encoded);if(index<0){index=recipeSnapshots.length;recipeSnapshots.push(n.recipe)}const {recipe,...rest}=n;return {...rest,title:recipe.title,recipeIndex:index}});
  next.history.unshift({id,date,kind:'purchase',items,...(recipeSnapshots.length?{recipeSnapshots}:{})});
  next.cart=next.cart.filter(item=>!bought(item));
  const known=new Set([...knownNames,...next.custom.map(item=>item.name)]);
  for(const item of items){next.stock[item.name]=2;if(!known.has(item.name)){next.custom.push({name:item.name,emoji:'🫙',category:'Saját tételek'});known.add(item.name)}}
  return next;
 }
};
if(typeof module!=='undefined')module.exports=ShoppingModel;
