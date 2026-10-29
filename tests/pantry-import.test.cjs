const test=require('node:test'),assert=require('node:assert/strict'),model=require('../household-model.js');
const base=()=>({stock:{Tej:0,Rizs:2},custom:[],cart:[{name:'Tej',quantity:3}],history:[{id:'trip',date:'2026-10-29'}],likes:['rice'],chats:{rice:['private']}});
const catalog=[{name:'Tej'},{name:'Rizs'},{name:'Tojás'}];
test('pantry copy unions present stock, including zeroed shared items, without changing other data',()=>{
 const source={stock:{Tej:2,Tojás:2,Elfogyott:0},cart:[{name:'Other'}]},target=base(),before=JSON.stringify([source,target]);
 const plan=model.pantryImportPlan(source,target,catalog);
 assert.deepEqual(plan.next.stock,{Tej:2,Rizs:2,Tojás:2});assert.deepEqual(plan.added,['Tej','Tojás']);
 for(const key of ['cart','history','likes','chats'])assert.deepEqual(plan.next[key],target[key]);
 assert.equal(JSON.stringify([source,target]),before);
});
test('legacy stock values normalize to existing server format and only present custom items are copied',()=>{
 const source={stock:{Tej:1,'Saját lekvár':3,'Régi tétel':2,Elfogyott:0},custom:[{name:'Saját lekvár',emoji:'🍑',category:'Other'},{name:'Nem otthon',emoji:'X'}]};
 const plan=model.pantryImportPlan(source,base(),catalog);
 assert.deepEqual(plan.next.custom.map(x=>x.name),['Saját lekvár','Régi tétel']);
 assert(plan.next.custom.every(x=>x.category==='Saját tételek'));
 const changes=model.diff([],plan.next).filter(x=>x.bucket==='stock');assert(changes.every(x=>x.value===2));
 assert.deepEqual(model.pantryImportPlan({stock:{Tej:1}},base(),catalog).next.stock,{Tej:2,Rizs:2});
});
test('repeated copies and case variants do not duplicate stock or custom items',()=>{
 const source={stock:{tej:2,'saját tétel':2},custom:[{name:'saját tétel'}]},target={...base(),custom:[{name:'Saját tétel',emoji:'🌿'}]};
 const first=model.pantryImportPlan(source,target,catalog).next,second=model.pantryImportPlan(source,first,catalog);
 assert.deepEqual(Object.keys(first.stock),['Tej','Rizs','Saját tétel']);assert.deepEqual(second.added,[]);assert.deepEqual(second.next,first);assert.equal(first.custom.length,1);assert.equal(first.custom[0].emoji,'🌿');
});
test('copy uses existing revision and record formats, preserving unrelated shared changes',()=>{
 const rows=[{bucket:'stock',key:'Tej',value:0,revision:7},{bucket:'stock',key:'Rizs',value:2,revision:4},{bucket:'cart',key:'Tej',value:{name:'Tej',quantity:9},revision:6}];
 const current=model.decode(rows,base()),plan=model.pantryImportPlan({stock:{Tej:2}},current,catalog);
 assert.deepEqual(model.diff(rows,plan.next),[{bucket:'stock',key:'Tej',value:2,expected:7}]);
 assert.deepEqual(model.decode([...rows.filter(x=>x.key!=='Tej'||x.bucket!=='stock'),{bucket:'stock',key:'Tej',value:2,revision:8}],base()).stock,{Rizs:2,Tej:2});
});
