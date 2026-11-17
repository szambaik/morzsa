const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../persistence-model.js'),C=require('../companion-model.js'),R=require('../recipe-room-model.js');
test('last-message metadata survives partial hydration, edits and concurrent devices',()=>{
 const base={kind:'chat',title:'Chat',updated:10,lastMessageAt:10};
 assert.equal(P.metadata({...base,messages:[{createdAt:20},{createdAt:15}]}).lastMessageAt,20);
 assert.equal(P.metadata({...base,lastMessageAt:30,messages:[{createdAt:20}]}).lastMessageAt,30);
 assert.equal(P.metadata({...base,messages:[],updated:100}).lastMessageAt,10);
 assert.equal(P.metadata({kind:'chat',messages:[]}).lastMessageAt,undefined);
 for(const previous of [base,undefined]){
  const merged=P.mergeMetadata({...base,lastMessageAt:40},{...base,title:'Renamed',lastMessageAt:20},previous);
  assert.equal(merged.lastMessageAt,40);assert.equal(merged.title,'Renamed');
 }
});
test('cloud workspace preserves long recipe history and stable message/recipe IDs without changing legacy limits',()=>{const recipe={title:'Recipe',summary:'Summary',minutes:20,recipeId:'10000000-0000-4000-8000-000000000001',ingredients:[{name:'Egg',amount:'1'}],steps:['Cook.']};const data={cloud:true,threads:Array.from({length:80},(_,i)=>({id:'t'+i,kind:'recipe',recipe,readOnly:i===1,messages:Array.from({length:70},(_,j)=>({id:'m'+j,role:'user',text:'Hi',createdAt:j+1}))}))};const out=C.workspace(data,R.recipe);assert.equal(out.threads.length,81);assert.equal(out.threads[1].messages.length,70);assert.equal(out.threads[1].messages[0].id,'m0');assert.equal(out.threads[1].recipe.recipeId,recipe.recipeId);assert.equal(C.historyGroups(out).shared.length,1);assert.equal(C.normalize({...data,cloud:false},R.recipe).threads.length,20)});
test('message merging preserves concurrent appends, server sequence and local photo previews',()=>{const a={id:'a',text:'saved',sequence:1,createdAt:1},b={id:'b',text:'remote',sequence:2,createdAt:2};const result=P.mergeMessages([a,b],[{...a,photo:'preview'},{id:'c',text:'offline',createdAt:3}]);assert.deepEqual(result.map(m=>m.id),['a','b','c']);assert.equal(result[0].photo,'preview');assert.deepEqual(P.mergeProgress({completedSteps:[0],cookingStep:1,status:'active'},{completedSteps:[1],cookingStep:2,status:'active'}).completedSteps,[0,1])});
test('feed exploration never violates preferences and has stable ordering',()=>{const list=[{id:'a',title:'Fast',minutes:15,tags:['vegetarian'],ingredients:[{name:'Egg'}]},{id:'b',title:'Meat',minutes:10,tags:[],ingredients:[{name:'Meat'}]},{id:'c',title:'Avoid',minutes:20,tags:['vegetarian'],ingredients:[{name:'Mushroom'}]}];const options={prefs:{diet:'vegetarian',avoid:['mushroom']}};assert.deepEqual(P.rank(list,options).map(r=>r.id),['a']);assert.deepEqual(P.rank(list),P.rank(list));assert.equal(P.message({id:'a',text:'Hi',role:'model',operations:[{action:'delete'}]}).operations,undefined)});
test('metadata reconciliation keeps local archive/title changes, remote unrelated fields and concurrent cooking progress',()=>{
 const base={title:'Old',language:'hu',archivedAt:1,completedSteps:[0],cookingStep:0,status:'active'};
 const remote={...base,language:'en',completedSteps:[0,2],cookingStep:2};const local={...base,title:'New',completedSteps:[0,1],cookingStep:1};delete local.archivedAt;
 const result=P.mergeMetadata(remote,local,base);assert.equal(result.title,'New');assert.equal(result.language,'en');assert.equal(result.archivedAt,undefined);assert.deepEqual(result.completedSteps,[0,1,2]);assert.equal(result.cookingStep,2);
});
