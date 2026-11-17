// Shared, versioned data contract. No model-provided markup, URLs or executable actions.
const CookingExperience = (() => {
 const types=['tip_card','substitution_card','troubleshooting_card','timer_card','ingredient_checklist','step_visual'];
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u0008]/.test(v);
 function guidance(value,recipe,step){
  if(!Array.isArray(recipe?.steps)||!Array.isArray(recipe?.ingredients)||!value||value.version!==1||value.step!==step||!Number.isInteger(step)||step<0||step>=recipe.steps.length||!Array.isArray(value.components)||value.components.length>4)return null;
  const components=[];
  for(const raw of value.components){
   if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
   const c=Object.fromEntries(Object.entries(raw).filter(([,v])=>v!==null));
   if(!c||!types.includes(c.type)||Object.keys(c).some(k=>!['type','title','text','ingredient','minutes','indices'].includes(k)))return null;
   if(c.type==='step_visual'){if(Object.keys(c).length!==1)return null;components.push({type:c.type});continue}
   if(!text(c.title,80))return null;
   if(c.type==='ingredient_checklist'){
    if(!Array.isArray(c.indices)||!c.indices.length||c.indices.length>15||!c.indices.every(i=>Number.isInteger(i)&&i>=0&&i<recipe.ingredients.length))return null;
    components.push({type:c.type,title:c.title,indices:[...new Set(c.indices)]});continue;
   }
   if(!text(c.text,700))return null;
   if(c.type==='substitution_card'&&!recipe.ingredients.some(i=>i.name===c.ingredient))return null;
   if(c.type==='timer_card'&&(!Number.isInteger(c.minutes)||c.minutes<1||c.minutes>120))return null;
   components.push({type:c.type,title:c.title,text:c.text,...(c.type==='substitution_card'?{ingredient:c.ingredient}:{}),...(c.type==='timer_card'?{minutes:c.minutes}:{})});
  }
  return {version:1,step,components};
 }
 function schema(){
  const component={type:'OBJECT',required:['type'],properties:{
   type:{type:'STRING',enum:types},title:{type:'STRING',nullable:true},text:{type:'STRING',nullable:true},
   ingredient:{type:'STRING',nullable:true},minutes:{type:'INTEGER',nullable:true},indices:{type:'ARRAY',nullable:true,items:{type:'INTEGER'}}
  }};
  return {type:'OBJECT',nullable:true,required:['version','step','components'],properties:{version:{type:'INTEGER',description:'Always 1'},step:{type:'INTEGER'},components:{type:'ARRAY',items:component}}};
 }
 const signature=portions=>portions?portions.base+':'+portions.target:'original';
 const difficulty=(recipe,language='hu')=>({easy:['Könnyű','Easy'],medium:['Közepes','Medium'],advanced:['Gyakorlatot igényel','Advanced']}[recipe.difficulty]||['Nehézség nincs megadva','Difficulty not specified'])[language==='en'?1:0];
 return {types,guidance,schema,signature,difficulty};
})();
if(typeof globalThis!=='undefined')globalThis.CookingExperience=CookingExperience;
if(typeof module!=='undefined')module.exports=CookingExperience;
