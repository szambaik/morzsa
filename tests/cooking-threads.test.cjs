const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../companion-model'),R=require('../recipe-room-model');
const recipe={title:'Palacsinta',summary:'Gyors édesség.',minutes:20,ingredients:[{name:'Tej',amount:'250 ml'},{name:'Tojás',amount:'2 db'}],steps:['Keverd össze.','Süsd meg.']};
test('explicit step completion persists independently of navigation and changes no household state',()=>{
 const book=M.startRecipe(M.workspace(null,R.recipe,1),recipe,'cook1',R.recipe,2),before=JSON.stringify(book);
 const navigated=M.setCookingStep(book,'cook1',1,R.recipe);assert.deepEqual(navigated.threads[1].completedSteps,[]);
 const done=M.completeCookingStep(book,'cook1',0,R.recipe);assert.deepEqual(done.threads[1].completedSteps,[0]);assert.equal(done.threads[1].cookingStep,1);assert.equal(JSON.stringify(book),before);
 assert.deepEqual(M.workspace(JSON.parse(JSON.stringify(done)),R.recipe).threads[1].completedSteps,[0]);
 assert.deepEqual(M.completeCookingStep(done,'cook1',0,R.recipe).threads[1].completedSteps,[0]);
 const ended=M.completeCookingStep(done,'cook1',1,R.recipe);assert.deepEqual(ended.threads[1].completedSteps,[0,1]);assert.equal(ended.threads[1].status,'active');
 const invalid={...ended,threads:ended.threads.map(t=>({...t,completedSteps:[0,0,-1,2,'1']}))};assert.deepEqual(M.workspace(invalid,R.recipe).threads[1].completedSteps,[0]);
 assert.throws(()=>M.completeCookingStep(done,'cook1',99,R.recipe),/INVALID_COOKING_STEP/);
 assert.throws(()=>M.completeCookingStep(M.finishRecipe(done,'cook1',R.recipe,'Done: '),'cook1',0,R.recipe),/INVALID_COOKING_STEP/);
});
test('migration preserves old conversations, is repeatable and uses isolated v2 storage',()=>{
 const old={active:'old',threads:[{id:'old',title:'Tegnap',messages:[{role:'user',text:'Vacsora?'}]}]},before=JSON.stringify(old);
 const b=M.workspace(old,R.recipe,1);assert.equal(b.threads[0].kind,'main');assert.equal(b.threads[1].kind,'legacy');assert.equal(b.threads[1].messages[0].text,'Vacsora?');assert.deepEqual(M.workspace(b,R.recipe),b);assert.equal(JSON.stringify(old),before);
 assert.notEqual(M.key('a','home','hu'),M.workspaceKey('a','home','hu'));assert.notEqual(M.workspaceKey('a','home','hu'),M.workspaceKey('a','other','hu'));assert.notEqual(M.workspaceKey('a','home','hu'),M.workspaceKey('b','home','hu'));
});
test('opening a recipe reuses its active conversation without mixing main history',()=>{
 const main=M.workspace(null,R.recipe,1);main.threads[0].messages=[{role:'user',text:'Elfogyott a kenyér.'}];
 const first=M.startRecipe(main,recipe,'cook1',R.recipe,2);first.threads[1].messages=[{role:'user',text:'Lehet zabtejjel?'}];
 const repeat=M.startRecipe(first,recipe,'unused',R.recipe,3);assert.equal(repeat.threads.length,2);assert.equal(repeat.active,'cook1');assert.equal(repeat.threads[1].messages[0].text,'Lehet zabtejjel?');assert.equal(repeat.threads[0].messages.length,1);assert.equal(main.threads.length,1);
 const another=M.startRecipe(repeat,{...recipe,title:'Másik recept'},'cook2',R.recipe,4);assert.equal(another.active,'cook2');assert.equal(another.threads[1].messages.length,0);
});
test('finishing is idempotent, preserves recipe context and allows a new cooking session',()=>{
 let b=M.startRecipe(M.workspace(null,R.recipe,1),recipe,'cook1',R.recipe,2);
 b=M.finishRecipe(b,'cook1',R.recipe,'Lezárt főzés: ',3);assert.equal(b.threads[1].status,'completed');assert.equal(b.threads[0].messages.length,1);assert.deepEqual(M.finishRecipe(b,'cook1',R.recipe,'Lezárt főzés: ',4),b);
 const next=M.startRecipe(b,recipe,'cook2',R.recipe,5);assert.equal(next.threads.length,3);assert.equal(next.active,'cook2');assert.equal(next.threads[2].status,'completed');
 next.threads[1].messages=Array.from({length:60},(_,i)=>({role:'user',text:String(i)}));const saved=M.workspace(next,R.recipe);assert.equal(saved.threads[1].messages.length,40);assert.deepEqual(saved.threads[1].recipe,recipe);
});
test('capacity never silently removes conversations when starting another recipe',()=>{
 const b=M.workspace({threads:Array.from({length:60},(_,i)=>({id:String(i),messages:[]}))},R.recipe);assert.equal(b.threads.length,61);assert.throws(()=>M.startRecipe(b,recipe,'new',R.recipe),/THREAD_LIMIT/);assert.equal(b.threads.length,61);
});
test('cooking context is validated, sent every turn, and separate from legacy read-only recipes',async()=>{
 const {normalizeInput,bodyFor}=await import('../supabase/functions/voice-command/handler.mjs');
 const request={assistant:true,companion:true,text:'Mivel kezdjem?',context:{cookingRecipe:recipe},history:[]};
 const input=normalizeInput(request),body=bodyFor(input);assert.deepEqual(input.context.cookingRecipe,recipe);assert.match(body.systemInstruction.parts[0].text,/focused cooking session/);assert.doesNotMatch(body.systemInstruction.parts[0].text,/Return NO operations/);assert.match(body.contents.at(-1).parts[0].text,/Palacsinta/);
 assert.throws(()=>normalizeInput({...request,companion:false}),/INVALID_INPUT/);assert.throws(()=>normalizeInput({...request,context:{cookingRecipe:{...recipe,steps:['x'.repeat(501)]}}}),/INVALID_INPUT/);
 const legacy=normalizeInput({assistant:true,text:'Help',context:{recipe:{name:'Palacsinta',ingredients:recipe.ingredients,steps:recipe.steps}}});assert.match(bodyFor(legacy).systemInstruction.parts[0].text,/Return NO operations/);
});
test('recipe progress defaults safely, survives saves and resume, and stays isolated by cooking session',()=>{
 let b=M.startRecipe(M.workspace(null,R.recipe,1),recipe,'cook1',R.recipe,2);
 assert.equal(b.threads[1].cookingStep,0);
 b=M.workspace(b,R.recipe);assert.equal(b.threads[1].cookingStep,0);
 const before=JSON.stringify(b);const moved=M.setCookingStep(b,'cook1',1,R.recipe);assert.equal(JSON.stringify(b),before);assert.equal(moved.threads[1].cookingStep,1);
 assert.equal(M.workspace(JSON.parse(JSON.stringify(moved)),R.recipe).threads[1].cookingStep,1);
 assert.equal(M.startRecipe(moved,recipe,'unused',R.recipe).threads[1].cookingStep,1);
 assert.throws(()=>M.setCookingStep(moved,'cook1',2,R.recipe),/INVALID_COOKING_STEP/);assert.throws(()=>M.setCookingStep(moved,'cook1',-1,R.recipe),/INVALID_COOKING_STEP/);assert.throws(()=>M.setCookingStep(moved,'morzsa-main',0,R.recipe),/INVALID_COOKING_STEP/);
 const bad={...moved,threads:moved.threads.map(t=>({...t,cookingStep:999}))};assert.equal(M.workspace(bad,R.recipe).threads[1].cookingStep,0);
 const completed=M.finishRecipe(moved,'cook1',R.recipe,'Done: ',5);const next=M.startRecipe(completed,recipe,'cook2',R.recipe,6);assert.equal(M.workspace(next,R.recipe).threads[1].cookingStep,0);assert.equal(next.threads[2].cookingStep,1);
});
test('the selected cooking step reaches AI context, old clients stay valid and invalid indices are rejected',async()=>{
 const {normalizeInput,bodyFor}=await import('../supabase/functions/voice-command/handler.mjs');
 const request={assistant:true,companion:true,text:'Mennyi ideig?',context:{cookingRecipe:recipe,cookingStep:1}};
 const normalized=normalizeInput(request);assert.equal(normalized.context.cookingStep,1);assert.match(bodyFor(normalized).systemInstruction.parts[0].text,/currently selected cooking step 2: Süsd meg/);
 assert.equal(normalizeInput({...request,context:{cookingRecipe:recipe}}).context.cookingStep,undefined);
 for(const index of [-1,2,1.5,'1'])assert.throws(()=>normalizeInput({...request,context:{...request.context,cookingStep:index}}),/INVALID_INPUT/);
 assert.throws(()=>normalizeInput({...request,context:{cookingStep:0}}),/INVALID_INPUT/);
});

test('named steps survive old-save loading, recipe resume and favourites without changing recipe identity',()=>{
 const named={...recipe,stepTitles:['A tészta összeállítása','A palacsinták sütése']};
 assert.deepEqual(R.recipe(recipe),recipe);assert.deepEqual(R.recipe(named),named);
 assert.equal(R.identity(named),R.identity(recipe));
 let b=M.startRecipe(M.workspace(null,R.recipe,1),named,'named',R.recipe,2);
 b=M.workspace(JSON.parse(JSON.stringify(b)),R.recipe);assert.deepEqual(b.threads[1].recipe,named);
 assert.equal(M.startRecipe(b,recipe,'duplicate',R.recipe).active,'named');
 assert.equal(R.favourites([recipe,named]).length,1);
 assert.equal(R.stepTitle(named,1),'A palacsinták sütése');assert.equal(R.stepTitle(recipe,1),'Süsd meg');
 assert.equal(R.recipe({...recipe,stepTitles:['Hiányos']}),null);
 assert.equal(R.recipe({...named,stepTitles:['x'.repeat(81),'Sütés']}),null);
});
test('AI accepts legacy recipes and bounded names, and requests detailed named instructions for new recipes',async()=>{
 const {validRecipes,geminiBody}=await import('../supabase/functions/recipe-ideas/handler.mjs');
 const {normalizeInput,bodyFor}=await import('../supabase/functions/voice-command/handler.mjs');
 const named={...recipe,stepTitles:['Tészta készítése','Palacsinta sütése']};
 assert(validRecipes({answer:'ok',recipes:[recipe]},true));assert(validRecipes({answer:'ok',recipes:[named]},true));
 assert(!validRecipes({answer:'ok',recipes:[{...named,stepTitles:['Sütés']}]},true));
 const input=normalizeInput({assistant:true,companion:true,text:'Mivel kezdjem?',context:{cookingRecipe:named,cookingStep:0}});
 assert.deepEqual(input.context.cookingRecipe,named);
 for(const body of [bodyFor(input),geminiBody({conversation:true,language:'hu',names:[],mood:'any'})]){
  assert.match(body.systemInstruction.parts[0].text,/2–4 clear sentences/);
  assert.match(body.systemInstruction.parts[0].text,/doneness cue/);
  const schema=body.generationConfig.responseSchema.properties.recipes.items;
  assert(schema.required.includes('stepTitles'));assert.equal(schema.properties.steps.items.type,'STRING');
 }
});
