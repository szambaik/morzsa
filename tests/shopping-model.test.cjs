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
test('unchecked custom reminders survive both finish modes, including old custom records',()=>{
 const source=base();source.custom=[{name:'Különleges tea',category:'Saját tételek'},{name:'Ajándék',category:'Saját tételek'}];
 source.cart.push({name:'Különleges tea',quantity:2,unit:'doboz',source:'Saját tétel',note:'ha látod'}, {name:'Ajándék',quantity:1,done:true});
 source.cart[1].source='Saját tétel';
 const categoryFor=n=>source.custom.some(i=>i.name===n)?'Saját tételek':'Gyümölcsök';
 const all=shopping.complete(source,{...options,categoryFor,includeUnchecked:true});
 assert.deepEqual(all.cart,[source.cart[2]]);assert.equal(all.stock.Ajándék,2);assert.equal(all.stock.Alma,2);assert.equal(all.stock['Különleges tea'],undefined);
 assert.equal(all.history[0].items.length,3);assert.deepEqual(all.likes,source.likes);assert.deepEqual(all.chats,source.chats);
 assert.equal(shopping.complete(all,{...options,categoryFor,includeUnchecked:true}),null);
 const checked=shopping.complete(source,{...options,categoryFor,includeUnchecked:false});assert.deepEqual(checked.cart,[source.cart[1],source.cart[2]]);
 const rows=[...household.encode(source).values()].map(r=>({...r,revision:5}));
 const changes=household.diff(rows,all);assert(!changes.some(c=>c.bucket==='cart'&&c.key==='Különleges tea'));assert(changes.some(c=>c.bucket==='cart'&&c.key==='Ajándék'&&c.expected===5));
});
