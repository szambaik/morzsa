// Purchase records keep the existing shape so old clients and archives remain readable.
const ShoppingModel={
 complete(source,{includeUnchecked,id,date,unitFor,categoryFor,knownNames=[]}){
  const purchased=source.cart.filter(item=>includeUnchecked||item.done);
  if(!purchased.length)return null;
  const next=JSON.parse(JSON.stringify(source));
  const items=purchased.map(item=>({...item,done:true,quantity:item.quantity||1,unit:item.unit||unitFor(item.name),category:categoryFor(item.name)}));
  next.history.unshift({id,date,kind:'purchase',items});
  next.cart=includeUnchecked?[]:next.cart.filter(item=>!item.done);
  const known=new Set([...knownNames,...next.custom.map(item=>item.name)]);
  for(const item of items){next.stock[item.name]=2;if(!known.has(item.name)){next.custom.push({name:item.name,emoji:'🫙',category:'Saját tételek'});known.add(item.name)}}
  return next;
 }
};
if(typeof module!=='undefined')module.exports=ShoppingModel;
