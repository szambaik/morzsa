const RecipeChat={
 request(state,recipe,language,categoryFor,excluded,uncertain=[]){
  const messages=state.chats[recipe.id]||[],current=messages.at(-1);if(current?.role!=='user')throw Error('Missing question');
  const stock=Object.keys(state.stock).filter(n=>state.stock[n]>0&&!excluded.has(categoryFor(n))).slice(0,1000);
  return {assistant:true,language,text:current.content.slice(0,2000),context:{stock,cart:[],uncertain:uncertain.filter(n=>stock.includes(n)),recipe:{name:recipe.name,ingredients:recipe.ingredients.map(([name,amount])=>({name,amount:String(amount)})),steps:recipe.steps}},history:messages.slice(0,-1).slice(-6).map(m=>({role:m.role==='assistant'?'model':'user',text:m.content.slice(0,5000)}))};
 }
};
if(typeof module!=='undefined')module.exports=RecipeChat;
