// Curated suggestions work offline and never change household data.
(function(root){
 function choose(recipes,stock,seen=[],random=Math.random){
  if(!recipes.length)return null;
  const ranked=recipes.map(recipe=>({recipe,fit:recipe.ingredients.length?recipe.ingredients.filter(([name])=>stock[name]>0).length/recipe.ingredients.length:0})).sort((a,b)=>b.fit-a.fit||a.recipe.time-b.recipe.time);
  const best=ranked[0].fit;
  const pool=ranked.filter(x=>best===0||x.fit>0&&x.fit>=best-.25).slice(0,4).map(x=>x.recipe);
  let available=pool.filter(r=>!seen.includes(r.id));
  if(!available.length){const last=seen.at(-1);available=pool.filter(r=>r.id!==last);if(!available.length)available=pool}
  return available[Math.min(available.length-1,Math.max(0,Math.floor(random()*available.length)))];
 }
 const api={choose};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SurpriseRecipe=api;
})(typeof window==='undefined'?globalThis:window);
