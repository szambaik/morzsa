// Loaded only by the opt-in, isolated local fixture. Never part of the production app.
(async()=>{
 while(!window.qaReferenceReady)await new Promise(r=>setTimeout(r,30));
 window.MORZSA_QA_UNIFIED_REFERENCE=true;const recipe=qaReferenceRecipes[3];window.MORZSA_QA_UNIFIED_RECIPE_ID=recipe.recipeId;
 const mount=RecipeImages.mount;RecipeImages.mount=(host,r,step,options)=>{
  if(host&&r.recipeId===recipe.recipeId&&(step<0||step===1)){host.classList.add('generated-recipe-image');host.innerHTML='<img src="assets/unified-workspace-reference/'+(step<0?'caesar-salad.webp':'chicken-step.webp')+'" alt="'+esc(r.title)+'">';return}
  return mount(host,r,step,options);
 };
 window.qaChatRequests=[];household.voiceCommandStream=async(p,onText)=>{qaChatRequests.push(structuredClone(p));onText('Szuper, ezekből több gyors étel is készülhet!');return {answer:'Szuper, ezekből több gyors étel is készülhet! A készlet alapján ezt ajánlom:',recipes:[recipe],operations:[],clarification:'',transcript:p.text}};
 const stocked=recipe.ingredients.map(i=>i.name).filter(n=>!['Kenyér','Sajt'].includes(n));
 const rows=[['Lilahagyma',1,'db'],['Alma',4,'db'],['Sárgarépa',.5,'kg'],['Tej',1,'l'],['Tojás',6,'db'],['Bab',1,'doboz'],['Rizs',1,'kg'],['Citrom',2,'db'],['Joghurt',2,'pohár'],['Kenyér',1,'db'],['Sajt',.2,'kg'],['Olaj',1,'l']].map(([name,quantity,unit])=>({name,...QuantityModel.normalize(quantity,unit),done:false}));
 if(!await saveVoiceState({...state,stock:{...Object.fromEntries(stocked.map(n=>[n,2])),Tej:1,'Tojás':2,Alma:2,Paprika:2},cart:rows}))throw Error('Unified fixture state did not save');await PantryReview.confirm(stocked);
 MorzsaProactive.recommendations=()=>[{id:'fixture-caesar',recipe,recipeId:recipe.recipeId,minutes:25,servings:2,home:stocked,check:[],missing:['Kenyér','Sajt'],total:11}];
 MorzsaHousehold.memberCount=()=>2;document.getElementById('household-button').textContent='Otthon';
 const checklist='morzsa-recipe-checklist-v1:'+JSON.stringify([household.userId()||'local',household.active||'local',recipe.recipeId]);if(!localStorage.getItem(checklist))localStorage.setItem(checklist,JSON.stringify({version:1,checked:recipe.ingredients.flatMap((i,n)=>stocked.includes(i.name)?[n]:[])}));
 MorzsaCompanion.newChat();MorzsaCompanion.ask('Mit főzzünk ma vacsorára? Van csirkemell, saláta és joghurt otthon, és valami gyorsat szeretnénk.');
 for(let i=0;i<120&&!document.querySelector('.companion-recipe');i++)await new Promise(r=>setTimeout(r,30));
 window.qaUnifiedRecipe=recipe;window.qaUnifiedReady=true;
})();
