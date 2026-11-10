const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../companion-model.js'),V=require('../voice-model.js'),R=require('../recipe-room-model.js');
const state={stock:{Tej:2,Tojás:2},cart:[],custom:[],history:[],likes:['keep'],chats:{private:'keep'}};
test('chat history is separated by user, household and language; legacy messages survive normalization',()=>{
 assert.notEqual(M.key('u','a','hu'),M.key('u','b','hu'));assert.notEqual(M.key('u','a','hu'),M.key('v','a','hu'));
 const old={threads:[{id:'t',messages:[{role:'user',text:'Hi'},{role:'model',text:'Proposed',operations:[{action:'stock_remove',name:'Tej'}],result:'Not saved'}]}]};
 const out=M.normalize(old,R.recipe);assert.equal(out.active,'t');assert.equal(out.threads[0].messages.length,2);assert.equal(out.threads[0].messages[1].operations,undefined);assert.match(M.history(out.threads[0].messages)[1].text,/Not saved/);
 assert.deepEqual(M.normalize(null).threads,[]);
});
test('proactive suggestions use checked purchases, explicit removals and real review metadata',()=>{
 assert.equal(M.suggestion(state,[]),null);
 assert.equal(M.suggestion(state,[{name:'Tej',unknown:true}]).type,'review');
 assert.equal(M.suggestion(state,[{name:'Tej'}],[],{'review:Tej':2000},1000),null);
 assert.equal(M.suggestion(state,[{name:'Tej'}],[],{'review:Tej':2000},3000).type,'review');
 const gone={...state,stock:{...state.stock,Tej:0}};assert.equal(M.suggestion(gone,[],['Tej']).type,'restock');
 assert.equal(M.suggestion({...gone,cart:[{name:'Tej',done:false}]},[],['Tej']),null);
 assert.equal(M.suggestion({...gone,cart:[{name:'Tej',done:true}]},[],['Tej']).type,'bought');
 assert.equal(M.suggestion({...state,stock:{Tej:0}},[{name:'Tej'}]),null);
});
test('repeat proposals are idempotent; unrelated household data and concurrent changes survive',()=>{
 const ops=[{action:'stock_remove',name:'Tej',quantity:null,unit:null},{action:'list_set',name:'Tej',quantity:null,unit:null}];
 const result=V.plan(state,ops,[{name:'Tej'}],()=> 'l'),repeat=V.plan(result.next,ops,[{name:'Tej'}],()=> 'l');
 assert.equal(result.next.cart[0].quantity,1);assert.equal(repeat.changes.length,0);assert.deepEqual(result.next.chats,state.chats);assert.deepEqual(result.next.likes,state.likes);
 assert.equal(M.fingerprint(state,ops),M.fingerprint({...state,stock:{...state.stock,Tojás:0}},ops));
 assert.notEqual(M.fingerprint(state,ops),M.fingerprint({...state,stock:{Tej:0}},ops));
 assert.notEqual(M.fingerprint(state,ops,()=>1),M.fingerprint(state,ops,()=>2));
 const changed={...result.next,cart:[{...result.next.cart[0],quantity:3},{name:'Alma',quantity:2}]};
 const undo=V.undo(changed,result.changes);assert.equal(undo.next.cart[0].quantity,3);assert.equal(undo.next.cart[1].name,'Alma');assert.equal(undo.next.stock.Tej,2);
});
test('history is bounded and does not persist executable proposals',()=>{
 const out=M.normalize({threads:Array.from({length:30},(_,i)=>({id:String(i),messages:Array.from({length:60},()=>({role:'user',text:'a'.repeat(7000)}))}))});
 assert.equal(out.threads.length,20);assert.equal(out.threads[0].messages.length,40);assert.equal(out.threads[0].messages[0].text.length,5000);assert.equal(M.history(out.threads[0].messages).length,6);
});
test('new companion recipe schema is opt-in and old requests/outputs remain supported',async()=>{
 const {normalizeInput,bodyFor,validOutput}=await import('../supabase/functions/voice-command/handler.mjs');
 const legacy=normalizeInput({assistant:true,text:'Hi'}),modern=normalizeInput({assistant:true,companion:true,text:'Recipe'});
 assert.equal(bodyFor(legacy).generationConfig.responseSchema.properties.recipes,undefined);
 assert.ok(bodyFor(modern).generationConfig.responseSchema.properties.recipes);
 const output={transcript:'Hi',clarification:'',operations:[],answer:'Hello'};
 assert.ok(validOutput(output));assert.ok(validOutput({...output,recipes:[]}));assert.equal(validOutput({...output,recipes:[{title:'broken'}]}),false);
});
test('purchase undo only reverses touched records and its exact archive, preserving later edits',()=>{
 const before={...state,cart:[{name:'Alma',done:true,quantity:1}],history:[{id:'older',items:[]}]};
 const after={...before,stock:{...before.stock,Alma:2},cart:[],history:[{id:'purchase',items:[{name:'Alma'}]},...before.history]};
 const changes=M.changes(before,after),concurrent={...after,stock:{...after.stock,Liszt:2},cart:[{name:'Tej',quantity:3}],history:[{id:'other',items:[]},...after.history]};
 const undo=V.undo(concurrent,changes).next;
 assert.equal(undo.stock.Alma,undefined);assert.equal(undo.stock.Liszt,2);assert.equal(undo.cart.find(i=>i.name==='Tej').quantity,3);assert.ok(undo.cart.find(i=>i.name==='Alma'));
 assert.deepEqual(undo.history.map(i=>i.id),['other','older']);
});
