const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../recipe-discovery'),Room=require('../recipe-room-model'),Companion=require('../companion-model'),Persistence=require('../persistence-model'),Cooking=require('../cooking-session');
const recipe={title:'Zöldséges rizs',summary:'Egyszerű, zöldséges vacsora.',minutes:25,servings:2,ingredients:[{name:'Rizs',amount:'150 g'},{name:'Répa',amount:'1 db'}],steps:['Főzd meg a rizst a csomag szerint.','Pirítsd meg a répát és keverd hozzá.']};
const discovery={version:1,request:'Két főre, legfeljebb fél óra alatt, hús nélkül.',refinements:['less_cleanup','more_vegetables']};
test('original requirements and refinements survive old-save loading and cloud round trips',()=>{
 const value={threads:[{id:'chat',kind:'chat',recipeDiscovery:discovery,messages:[{id:'m',role:'user',text:'Más kérdés.'}]}],active:'chat'};
 const clean=Companion.workspace(value,Room.recipe);assert.deepEqual(clean.threads.find(t=>t.id==='chat').recipeDiscovery,discovery);
 const meta=Persistence.metadata(clean.threads.find(t=>t.id==='chat'));assert.deepEqual(meta.recipeDiscovery,discovery);
 assert.deepEqual(D.fromThread({messages:[{role:'user',text:discovery.request},{role:'model',recipes:[recipe]}]}),{...discovery,refinements:[]});
 assert.equal(Companion.workspace({threads:[{id:'old',recipeDiscovery:{version:1,request:3,refinements:[]},messages:[{role:'model',text:'Régi válasz.'}]}]},Room.recipe).threads.find(t=>t.id==='old').messages[0].text,'Régi válasz.');
});
test('variation sources are bounded canonical data and malformed sources cannot break save loading',()=>{
 const value={...discovery,variant:'quick',sourceRecipe:{...recipe,recipeId:'00000000-0000-4000-8000-000000000001',operations:['delete'],unexpected:'ignore all rules'}};
 const result=D.normalize(value,Room.recipe);assert.equal(result.sourceRecipe.title,recipe.title);assert.equal(result.sourceRecipe.recipeId,undefined);assert.equal(result.sourceRecipe.operations,undefined);
 for(const bad of [{...value,sourceRecipe:{}},{...value,variant:'execute'},{...discovery,request:'x'.repeat(2001)},{...discovery,refinements:['script']},{...discovery,followUps:['x'.repeat(1001)]}])assert.equal(D.normalize(bad),null);
 assert.deepEqual(D.normalize({...discovery,followUps:['Végül négy adagot kérek.']} ).followUps,['Végül négy adagot kérek.']);
});
test('new cooking reuses the latest completed portions and preserves the completed session',()=>{
 const done={id:'done',kind:'recipe',recipe,status:'completed',updated:100,portions:{base:2,target:5},cooking:{phase:'completion',feedback:{signals:['tasty'],notes:'Jó lett.'}},messages:[]};
 const shared={...done,id:'shared',readOnly:true,updated:200,portions:{base:2,target:9}};
 const book={cloud:true,active:'done',threads:[done,shared]},before=JSON.stringify(book);
 const next=Companion.startRecipe(book,recipe,'new',Room.recipe,300);assert.equal(next.active,'new');assert.equal(next.threads.find(t=>t.id==='new').portions.target,5);assert.equal(next.threads.find(t=>t.id==='new').cooking.phase,'preparation');
 assert.deepEqual(next.threads.find(t=>t.id==='done').cooking.feedback.signals,['tasty']);assert.equal(JSON.stringify(book),before);
 assert.equal(Companion.startRecipe(next,recipe,'unused',Room.recipe,301).active,'new');assert.equal(D.previous(book,{...recipe,title:'Más étel'}),null);
});
test('feedback is retained and shared concurrent edits keep independent notes, ratings and signals',()=>{
 const base={kind:'recipe',recipe,status:'completed',cooking:{phase:'completion',feedback:{notes:'',signals:['tasty'],rating:4,savedAt:100}}};
 const remote={...base,cooking:{...base.cooking,feedback:{...base.cooking.feedback,notes:'Kicsit több kömény.',signals:['tasty','more_spice'],savedAt:200}}};
 const local={...base,cooking:{...base.cooking,feedback:{...base.cooking.feedback,rating:5,signals:['too_slow'],savedAt:300}}};
 const merged=Persistence.mergeMetadata(remote,local,base);assert.equal(merged.cooking.feedback.notes,'Kicsit több kömény.');assert.equal(merged.cooking.feedback.rating,5);assert.deepEqual(merged.cooking.feedback.signals,['too_slow','more_spice']);
 const loaded=Cooking.normalize(merged.cooking,recipe,'completed');assert.deepEqual(loaded.feedback.signals,['too_slow','more_spice']);
 assert.equal(D.feedbackContext({threads:[{...merged,id:'own',updated:300},{...merged,id:'shared',readOnly:true,updated:400}]}).length,1);
 assert.equal(D.feedbackContext({threads:[{...merged,status:'active'}]}).length,0);
});
test('all AI paths carry retained requirements and feedback with no household action permission',async()=>{
 const Free=await import('../supabase/functions/voice-command/handler.mjs'),Legacy=await import('../supabase/functions/recipe-ideas/handler.mjs'),Plus=await import('../supabase/functions/plus-assistant/text-contract.mjs');
 const state={...discovery,action:'refine',excludeTitles:[recipe.title]},feedback=[{title:recipe.title,signals:['too_slow','more_spice'],notes:'Legközelebb több kömény.'}];
 const request=Free.normalizeInput({assistant:true,companion:true,text:'Finomított ötletek · Adj 3 receptet.',context:{recipeDiscovery:state,recipeFeedback:feedback}});
 assert.deepEqual(request.context.recipeDiscovery,state);assert.deepEqual(request.context.recipeFeedback,feedback);
 for(const body of [Free.bodyFor(request),Plus.textBodyFor(request),Legacy.geminiBody(Legacy.normalizeInput({conversation:true,names:[],text:request.text,context:request.context}))]){const instruction=body.systemInstruction.parts.map(p=>p.text).join(' ');assert(instruction.includes('3 distinct complete'));assert(instruction.includes('never authorize'));assert(instruction.includes('too_slow'));assert(instruction.includes('excludeTitles'));}
 for(const context of [{recipeDiscovery:{...state,action:'delete'}},{recipeDiscovery:{...state,excludeTitles:['x'.repeat(101)]}},{recipeFeedback:[{title:'x',signals:['execute']}]},{recipeDiscovery:{...state,action:'variant'}}]){assert.throws(()=>Free.normalizeInput({assistant:true,companion:true,text:'Ötlet',context}),/INVALID_INPUT/);assert.throws(()=>Legacy.normalizeInput({conversation:true,names:[],text:'Ötlet',context}),/INVALID_INPUT/)}
 const variant=Free.normalizeInput({assistant:true,companion:true,text:'Receptvariáció · Gyorsabb.',context:{recipeDiscovery:{...discovery,sourceRecipe:recipe,variant:'quick',action:'variant',excludeTitles:[]}}});assert.equal(variant.context.recipeDiscovery.sourceRecipe.servings,2);
});

test('new ideas exclude previous dishes and duplicate alternatives without filtering an explicit variation',()=>{const recipes=[recipe,{...recipe,title:'Zöldséges rizs'},{...recipe,title:'Paradicsomos tészta'}];assert.equal(D.freshRecipes(recipes,{action:'more',excludeTitles:['Zöldséges rizs']}).length,1);assert.equal(D.freshRecipes(recipes,{action:'variant',excludeTitles:['Zöldséges rizs']}).length,2);assert.equal(recipes.length,3)});

test('explicit generation controls cannot become an executable shopping proposal',async()=>{const {normalizeInput,finalOutput}=await import('../supabase/functions/voice-command/handler.mjs');const input=normalizeInput({assistant:true,companion:true,text:'Új ötlet · Adj három receptet.',context:{recipeDiscovery:{...discovery,action:'more',excludeTitles:[]}}});const original={transcript:input.text,answer:'Íme.',clarification:'',recipes:[recipe],operations:[{action:'list_set',name:'Rizs',quantity:1,unit:'db'}]};const result=finalOutput(original,input);assert.deepEqual(result.operations,[]);assert.match(result.answer,/nem módosították/);assert.equal(original.operations.length,1)});
