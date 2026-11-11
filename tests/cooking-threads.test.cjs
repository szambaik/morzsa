const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../companion-model'),R=require('../recipe-room-model');
const recipe={title:'Palacsinta',summary:'Gyors édesség.',minutes:20,ingredients:[{name:'Tej',amount:'250 ml'},{name:'Tojás',amount:'2 db'}],steps:['Keverd össze.','Süsd meg.']};
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
