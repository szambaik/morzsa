const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../recipe-portions'),R=require('../recipe-room-model'),C=require('../companion-model'),Shopping=require('../recipe-shopping'),Persistence=require('../persistence-model');
const apple={title:'Almás sütemény',summary:'Kis formában, két főre.',minutes:55,ingredients:[{name:'Alma',amount:'2 közepes db'},{name:'Liszt',amount:'100 g'},{name:'Tojás',amount:'1 db'},{name:'Sütőpor',amount:'fél teáskanál'},{name:'Citrom',amount:'néhány csepp lé'}],steps:['Süsd 180 °C-on 30 percig.']};
test('legacy serving count is recovered only from explicit recipe description',()=>{
 assert.deepEqual(P.base(apple),{value:2,source:'description'});assert.equal(P.base({...apple,summary:'For 4 people.'}).value,4);assert.equal(P.base({...apple,summary:'Gyors sütemény két almából.'}).value,null);
 assert.equal(P.selection({...apple,summary:'Simple pie'},null),null);assert.equal(P.selection({...apple,summary:'Simple pie'},{base:4,target:6}).target,6);
});
test('scaling changes only presentation quantities and never temperatures, time or cached identity',()=>{
 const before=JSON.stringify(apple),view=P.view(apple,{base:2,target:4});
 assert.deepEqual(view.ingredients.map(i=>i.amount),['4 közepes db','200 g','2 db','1 teáskanál','néhány csepp lé']);assert.equal(view.servings,4);assert.match(view.summary,/4 főre/);
 assert.equal(view.steps,apple.steps);assert.equal(view.minutes,55);assert.equal(JSON.stringify(apple),before);
 assert.equal(P.amount('100–200 g',2),'100–200 g');assert.equal(P.amount('ízlés szerint',2),'ízlés szerint');
});
test('generated servings and pan size survive recipe validation and reject unbounded metadata',async()=>{
 const r={...apple,servings:2,equipment:['16 cm átmérőjű sütőforma']},api=await import('../supabase/functions/recipe-ideas/handler.mjs'),voice=await import('../supabase/functions/voice-command/handler.mjs');
 assert.deepEqual(R.recipe(r),r);assert(api.validRecipes({answer:'Recipe',recipes:[r]},true));
 const scaled=P.view(r,{base:2,target:4});assert.deepEqual(voice.normalizeInput({text:'Milyen formát használjak?',assistant:true,companion:true,context:{cookingRecipe:scaled,cookingStep:0}}).context.cookingRecipe,scaled);
 for(const bad of [{...r,servings:0},{...r,servings:2.5},{...r,equipment:['a'.repeat(101)]}]){assert.equal(R.recipe(bad),null);assert.equal(api.validRecipes({answer:'ok',recipes:[bad]},true),false)}
});
test('portion choice survives cooking resume and cloud metadata without altering canonical recipe',()=>{
 const r={...apple,servings:2},book=C.startRecipe(C.workspace(null,R.recipe),r,'cook',R.recipe),changed=C.setPortions(book,'cook',{base:2,target:4},R.recipe),t=C.workspace(JSON.parse(JSON.stringify(changed)),R.recipe).threads.find(t=>t.id==='cook');
 assert.deepEqual(t.portions,{base:2,target:4});assert.deepEqual(t.recipe,r);assert.deepEqual(Persistence.metadata(t).portions,t.portions);assert.equal(C.startRecipe(changed,r,'unused',R.recipe).active,'cook');
 assert.deepEqual(Persistence.mergeMetadata({...Persistence.metadata(t),cookingStep:1},{...Persistence.metadata(t),portions:{base:2,target:6}},Persistence.metadata(t)).portions,{base:2,target:6});
 assert.throws(()=>C.setPortions(book,'cook',{base:2,target:0},R.recipe),/INVALID_PORTIONS/);
});
test('selected amounts reach newly added shopping rows while manual and partner quantities stay intact',()=>{
 const source={stock:{},cart:[{name:'Liszt',quantity:1,unit:'kg',done:true}],custom:[]},before=JSON.stringify(source),plan=Shopping.plan(source,apple,n=>n,()=> 'db',null,{base:2,target:4});
 assert.equal(plan.next.cart.find(i=>i.name==='Alma').quantity,4);assert.equal(plan.next.cart.find(i=>i.name==='Tojás').quantity,2);assert.equal(plan.next.cart[0].quantity,1);assert.equal(plan.next.cart[0].done,true);assert.equal(plan.next.cart[0].recipeNeeds[0].amount,'200 g');assert.deepEqual(plan.next.cart[0].recipeNeeds[0].portions,{base:2,target:4});assert.equal(JSON.stringify(source),before);
 assert.deepEqual(Shopping.plan(plan.next,apple,n=>n,()=> 'db',null,{base:2,target:4}).next,plan.next);
 assert.deepEqual(Shopping.amount('1,5 db','db'),{quantity:2,unit:'db'});assert.deepEqual(Shopping.amount('1500 g','g'),{quantity:1.5,unit:'kg'});
});

test('opening an existing catalogue recipe with newly visible serving metadata reuses its cooking thread',()=>{
 const legacy={...apple,recipeId:'10000000-0000-4000-8000-000000000001'},book=C.startRecipe(C.workspace(null,R.recipe),legacy,'old',R.recipe),next=C.startRecipe(book,{...legacy,servings:2,equipment:['16 cm forma']},'unused',R.recipe);
 assert.equal(next.active,'old');assert.equal(next.threads.length,2);assert.equal(next.threads[1].recipe.servings,2);
});
