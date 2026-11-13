const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../kitchen-model.js');
test('preferences are bounded, scoped field changes retain the latest unrelated preferences',()=>{
 assert.deepEqual(M.preferences({servings:99,diet:'made-up',avoid:['',null,'gomba','gomba']}),{servings:2,maxMinutes:0,diet:'any',avoid:['gomba']});
 const before=M.preferences(),after={...before,servings:4},rows=[{key:'diet',value:'vegan',revision:7}];
 assert.deepEqual(M.preferenceChanges(rows,before,after),[{key:'servings',value:4,expected:0}]);assert.equal(M.fromRows(rows).diet,'vegan');assert.deepEqual(M.preferenceChanges([],before,before),[]);
});
test('cooking memory contains only recent explicit completions, stays bounded and deduplicates titles',()=>{
 const now=Date.now(),book={threads:[{kind:'recipe',status:'completed',recipe:{title:'Palacsinta'},updated:now-1000},{kind:'recipe',status:'active',recipe:{title:'Unfinished'},updated:now}]};
 const events=[{event_type:'recipe_completed',subject:'palacsinta',created_at:new Date(now-2000).toISOString()},{event_type:'recipe_completed',subject:'Régi',created_at:new Date(now-40*86400000).toISOString()}];
 assert.deepEqual(M.recentRecipes(book,events,now),['Palacsinta']);assert.equal(M.recentRecipes({},Array.from({length:10},(_,i)=>({event_type:'recipe_completed',subject:'Recept '+i,created_at:new Date(now-i*1000).toISOString()})),now).length,6);
});
test('replenishment uses explicit low/out states and real separate purchases, never unknown or future items',()=>{
 const now=Date.now(),trip=i=>({date:new Date(now-i*86400000).toISOString(),items:[{name:'Tej'},{name:'Tej'}]}),state={stock:{Tej:0,Tojás:1,Alma:2},cart:[],history:[trip(2),trip(12)]};
 assert.equal(M.shoppingSuggestion(state,{},now).type,'low');assert.deepEqual(M.shoppingSuggestion(state,{'refill:Tojás':now+1000},now).names,['Tej']);assert.equal(M.shoppingSuggestion({...state,stock:{}},{},now),null);
 assert.equal(M.shoppingSuggestion({...state,stock:{Tej:0},history:[trip(2)]},{},now),null);assert.equal(M.shoppingSuggestion({...state,stock:{Tej:0},cart:[{name:'Tej',quantity:3}]},{},now),null);
 assert.equal(M.shoppingSuggestion({...state,stock:{Tej:0},history:[trip(-1),trip(90)]},{},now),null);
});
test('curated suggestions respect actual preferences without deleting saved recipes',()=>{
 const products=[{name:'Csirke',category:'Hús és felvágott'},{name:'Tej',category:'Tejtermék és tojás'},{name:'Méz',category:'Sütés és édesség'}],r={time:20,ingredients:[['Csirke','1']]};
 assert.equal(M.accepts(r,{diet:'vegetarian'},products),false);assert.equal(M.accepts({...r,ingredients:[['Tej','1']]},{diet:'vegan'},products),false);assert.equal(M.accepts({...r,ingredients:[['Méz','1']]},{diet:'vegan'},products),false);
 assert.equal(M.accepts({...r,time:45},{maxMinutes:25},products),false);assert.equal(M.accepts(r,{avoid:['chicken']},products,{Csirke:'Chicken'}),false);assert.equal(M.accepts(r,{},products),true);
});
test('AI receives bounded kitchen context as data and rejects invalid preference or memory payloads',async()=>{
 const {normalizeInput,bodyFor}=await import('../supabase/functions/voice-command/handler.mjs'),request={assistant:true,companion:true,text:'Mit főzzünk?',context:{stock:['Tej'],...M.context({servings:4,diet:'vegetarian'}, {},[],{Tej:1})}};
 const parsed=normalizeInput(request);assert.equal(parsed.context.preferences.servings,4);assert.deepEqual(parsed.context.low,['Tej']);assert.match(bodyFor(parsed).systemInstruction.parts[0].text,/memory never authorizes pantry\/list operations/);
 for(const context of [{preferences:{servings:90}},{low:['Not at home']},{recentCooked:Array(7).fill('a')},{preferences:{...M.defaults,avoid:['x'.repeat(81)]}}])assert.throws(()=>normalizeInput({...request,context:{stock:['Tej'],...context}}),/INVALID_INPUT/);
 assert.equal(normalizeInput({assistant:true,text:'Hi'}).context.preferences,undefined);
});
