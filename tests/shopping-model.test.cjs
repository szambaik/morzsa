const test=require('node:test'),assert=require('node:assert/strict'),shopping=require('../shopping-model.js'),household=require('../household-model.js');
const base=()=>({stock:{Rizs:2},cart:[{name:'Tej',quantity:2,unit:'l',done:true},{name:'Alma',quantity:3,unit:'db',done:false}],custom:[],history:[{id:'old',date:'2026-10-01',kind:'purchase',items:[]}],likes:['rice'],chats:{rice:['private']}});
const options={id:'new',date:'2026-10-29',unitFor:()=> 'db',categoryFor:()=> 'Test',knownNames:['Tej','Alma']};
test('checked-only completion leaves unchecked items on the list and archives only purchases',()=>{
 const source=base(),before=JSON.stringify(source),next=shopping.complete(source,{...options,includeUnchecked:false});
 assert.deepEqual(next.cart,[source.cart[1]]);assert.deepEqual(next.stock,{Rizs:2,Tej:2});assert.equal(next.history[0].items.length,1);assert.equal(next.history[0].items[0].quantity,2);assert.equal(next.history[0].items[0].unit,'l');assert.equal(next.history[0].items[0].done,true);assert.deepEqual(next.history[1],source.history[0]);assert.deepEqual(next.chats,source.chats);assert.equal(JSON.stringify(source),before);
});
test('include all retains previous completion semantics and supports old items without done or units',()=>{
 const source={...base(),cart:[{name:'Saját termék'}]},next=shopping.complete(source,{...options,includeUnchecked:true});
 assert.deepEqual(next.cart,[]);assert.equal(next.stock['Saját termék'],2);assert.equal(next.history[0].kind,'purchase');assert.equal(next.history[0].items[0].quantity,1);assert.equal(next.history[0].items[0].unit,'db');assert.equal(next.custom[0].category,'Saját tételek');
});
test('no checked purchases makes no empty archive and repeat completion cannot duplicate a purchase',()=>{
 const source=base(),first=shopping.complete(source,{...options,includeUnchecked:false});
 assert.equal(shopping.complete(first,{...options,includeUnchecked:false}),null);assert.equal(shopping.complete({...source,cart:[]},{...options,includeUnchecked:true}),null);
});
test('shared completion is one existing-format revision-checked batch and does not delete unchecked rows',()=>{
 const source=base(),rows=[...household.encode(source).values()].map(r=>({...r,revision:7}));
 const changes=household.diff(rows,shopping.complete(source,{...options,includeUnchecked:false}));
 assert(changes.some(x=>x.bucket==='cart'&&x.key==='Tej'&&x.value===null&&x.expected===7));assert(!changes.some(x=>x.bucket==='cart'&&x.key==='Alma'));assert(changes.some(x=>x.bucket==='history'&&x.key==='new'));assert(!JSON.stringify(changes).includes('private'));
});
