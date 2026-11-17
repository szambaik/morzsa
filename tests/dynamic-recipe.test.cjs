const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../cooking-session'),E=require('../cooking-experience'),P=require('../recipe-portions'),R=require('../recipe-room-model'),M=require('../persistence-model');
const recipe={title:'Rizs',summary:'Egyszerű köret.',servings:3,minutes:20,ingredients:[{name:'Rizs',amount:'150 g'},{name:'Só',amount:'½ tk'}],steps:['Főzd 150 g rizzsel 15 percig, 180 °C-on.','Pihentesd.'],equipment:['Lábas']};
const thread=()=>({recipe,status:'active',cookingStep:0,portions:{base:3,target:1},cooking:{phase:'guided',timers:[]}});
test('fractions stay exact and method amounts use the same scaling without changing heat or time',()=>{
 assert.equal(P.amount('½ tk',1/3),'1/6 tk');assert.equal(P.amount('1 1/2 ek',2),'3 ek');assert.equal(P.amount('1/8 tk',.5),'0,0625 tk');assert.equal(P.parse('1/0 g'),null);
 assert.equal(P.method(recipe.steps[0],recipe,{base:3,target:1}),'Főzd 50 g rizzsel 15 percig, 180 °C-on.');
 assert.equal(P.method('1150 g, 150 g, 150 g.',recipe,{base:3,target:1}),'1150 g, 50 g, 50 g.');
 assert.equal(recipe.ingredients[0].amount,'150 g');
});
test('paused timers survive long background gaps, resume, reset and repeated actions independently',()=>{
 const t=thread();t.cooking=C.addTimer(t,{id:'a',minutes:5,label:'Rizs'},1000000);t.cooking=C.addTimer(t,{id:'b',minutes:10,label:'Másik edény'},1000000);
 t.cooking=C.timerAction(t,'a','pause',1060500);const serialized=JSON.parse(JSON.stringify(t));serialized.cooking=C.normalize(serialized.cooking,recipe);
 assert.equal(C.remaining(serialized.cooking.timers[0],9000000),240);assert.equal(C.remaining(serialized.cooking.timers[1],9000000),0);
 assert.deepEqual(C.timerAction(serialized,'a','pause',9000000),serialized.cooking);
 serialized.cooking=C.timerAction(serialized,'a','resume',9000000);assert.equal(C.remaining(serialized.cooking.timers[0],9060000),180);
 serialized.cooking=C.timerAction(serialized,'a','reset',9100000);assert.equal(C.remaining(serialized.cooking.timers[0],9900000),300);
 assert.equal(C.context(serialized,9900000).timers[0].paused,true);
 assert.throws(()=>C.timerAction({...serialized,readOnly:true},'a','resume'),/INVALID/);
});
test('session pause leaves running timers alone and newest pause survives concurrent unrelated edits',()=>{
 const t=thread();t.cooking=C.addTimer(t,{id:'a',minutes:5,label:'Rizs'},1000000);const base=M.metadata(t);
 const paused={...base,cooking:C.pause(t,true,1100000)},other={...base,cooking:{...base.cooking,feedback:{notes:'Másik eszköz'}}};
 const merged=M.mergeMetadata(paused,other,base);assert.equal(merged.cooking.paused,true);assert.equal(C.remaining(merged.cooking.timers[0],1120000),180);
 assert.equal(merged.cooking.feedback.notes,'Másik eszköz');assert.deepEqual(merged.recipe,recipe);
});
test('cancelled timers cannot resurrect on equal-time concurrent timer edits',()=>{
 const t=thread();t.cooking=C.addTimer(t,{id:'a',minutes:5,label:'Rizs'},1000000);
 const cancel=C.timerAction(t,'a','cancel',1100000),pause=C.timerAction(t,'a','pause',1100000);
 assert.equal(C.merge(cancel,pause).timers[0].cancelled,true);assert.equal(C.merge(pause,cancel).timers[0].cancelled,true);
});
test('validated components can only refer to canonical ingredients and bounded user-started timers',()=>{
 const valid={version:1,step:0,components:[{type:'substitution_card',title:'Másik rizs',text:'Ellenőrizd a csomag főzési idejét.',ingredient:'Rizs'},{type:'timer_card',title:'Pihentetés',text:'Indítsd, ha levetted a tűzről.',minutes:5}]};
 assert.deepEqual(E.guidance(valid,recipe,0),valid);
 for(const bad of [{...valid,version:2},{...valid,step:1},{...valid,components:[{type:'script',text:'alert(1)'}]},{...valid,components:[{...valid.components[0],ingredient:'Ismeretlen'}]},{...valid,components:[{...valid.components[1],minutes:0}]},{...valid,components:[{...valid.components[0],actions:['stock_remove']}]},{...valid,components:[{type:'ingredient_checklist',title:'Kézhez',indices:[99]}]}])assert.equal(E.guidance(bad,recipe,0),null);
 const strict={version:1,step:0,components:[{type:'step_visual',title:null,text:null,ingredient:null,minutes:null,indices:null}]};assert.deepEqual(E.guidance(strict,recipe,0).components,[{type:'step_visual'}]);
});
test('guidance survives reload and cloud metadata but is hidden after portions or step changes',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),ctx={window:{},CookingExperience:E,RecipePortions:P,RecipeRoomModel:R,CookingSession:C};vm.runInNewContext(fs.readFileSync(require.resolve('../cooking-ui'),'utf8'),ctx);
 const t=thread();t.cooking.guidance={version:1,step:0,portions:'3:1',components:[{type:'tip_card',title:'<img src=x>',text:'<script>alert(1)</script>'}]};
 const loaded={...t,cooking:C.normalize(M.metadata(t).cooking,recipe)},opts={esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),say:hu=>hu};
 const html=ctx.window.CookingUI.guidance(loaded,opts);assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));
 assert.equal(ctx.window.CookingUI.guidance({...loaded,portions:{base:3,target:2}},opts),'');assert.equal(ctx.window.CookingUI.guidance({...loaded,cookingStep:1},opts),'');
 assert.equal(M.metadata({...t,cooking:{...t.cooking,feedback:{leftoverPortions:2}}}).cooking.feedback.leftoverPortions,2);
});
test('both provider paths discard invalid UI without losing a useful answer or authorizing writes',async()=>{
 const {normalizeInput,bodyFor,finalOutput}=await import('../supabase/functions/voice-command/handler.mjs'),{textBodyFor}=await import('../supabase/functions/plus-assistant/text-contract.mjs'),{responsesBody}=await import('../supabase/functions/plus-assistant/openai.mjs');
 const input=normalizeInput({assistant:true,companion:true,text:'Mire figyeljek?',context:{cookingRecipe:recipe,cookingStep:0,cookingSession:{phase:'guided',paused:true,completedSteps:[],timers:[]}}});
 const base={transcript:'Mire figyeljek?',answer:'A csomag utasítása szerint.',clarification:'',recipes:[],operations:[]};
 const result=finalOutput({...base,cookingUI:{version:1,step:0,components:[{type:'html',text:'<script>'}]}},input);assert.deepEqual(result,base);
 assert(bodyFor(input).generationConfig.responseSchema.properties.cookingUI);const schema=responsesBody(textBodyFor(input),{}).text.format.schema;assert(schema.properties.cookingUI.type.includes('null'));
 assert.equal(input.context.cookingSession.paused,true);assert.deepEqual(result.operations,[]);
});
