const {test}=require('node:test');
const assert=require('node:assert/strict');
const Entry=require('../workspace-entry.js'),Quick=require('../quick-entry.js');
const catalog=[{name:'Tej',category:'Tejtermék és tojás'},{name:'Tojás',category:'Tejtermék és tojás'},{name:'Alma',category:'Gyümölcsök'}];
const seed=()=>({stock:{Tej:3},custom:[],cart:[{name:'Alma',quantity:4,unit:'kg',done:false,recipeSources:[{key:'r',title:'Almás süti'}]}],likes:['r'],history:[{id:'h'}],futureField:{keep:true}});
const plan=(state,names,target)=>Entry.plan(state,names,target,catalog,()=> 'db',Quick.norm);
test('quick collection resolves aliases, typos and duplicates',()=>{assert.deepEqual(Entry.collect(['milk','tej','tojas','Alma'],['Tojás'],catalog,{Tej:'Milk'},Quick),['Tojás','Tej','Alma'])});
test('list entry is idempotent and preserves quantities, recipe sources and unrelated data',()=>{const before=seed(),first=plan(before,['Alma','Tej','tej'],'cart');assert.deepEqual(first.changed,['Tej']);assert.deepEqual(first.next.cart[0],before.cart[0]);assert.equal(first.next.cart.length,2);assert.deepEqual(first.next.futureField,before.futureField);assert.deepEqual(first.next.history,before.history);assert.deepEqual(plan(first.next,['Alma','Tej'],'cart').changed,[]);assert.equal(before.cart.length,1)});
test('pantry entry preserves present values and does not change the list',()=>{const before=seed(),result=plan(before,['Tej','Tojás'],'stock');assert.equal(result.next.stock.Tej,3);assert.equal(result.next.stock.Tojás,2);assert.deepEqual(result.next.cart,before.cart);assert.deepEqual(plan(result.next,['Tej','Tojás'],'stock').changed,[])});
test('custom products use the existing category and old saved fields survive',()=>{const before=seed(),result=plan(before,['Saját müzli','saját müzli'],'cart');assert.equal(result.next.custom.length,1);assert.equal(result.next.custom[0].category,'Saját tételek');assert.equal(result.next.cart.length,2);assert.deepEqual(result.next.likes,before.likes)});
test('a checked list item is reopened without erasing its chosen quantity or recipe metadata',()=>{const before=seed();before.cart[0].done=true;const result=plan(before,['Alma'],'cart');assert.equal(result.next.cart[0].done,false);assert.equal(result.next.cart[0].quantity,4);assert.deepEqual(result.next.cart[0].recipeSources,before.cart[0].recipeSources)});
test('planning against the latest state preserves another member’s intervening additions',()=>{const latest=seed();latest.cart.push({name:'Tojás',quantity:6,unit:'db',done:false});latest.stock.Tojás=2;const result=plan(latest,['Tej'],'cart');assert.equal(result.next.cart.find(i=>i.name==='Tojás').quantity,6);assert.equal(result.next.stock.Tojás,2)});
test('availability remains compatible with old numeric pantry states and keeps unknown distinct',()=>{
 assert.equal(Entry.availability(2),'home');assert.equal(Entry.availability(5),'home');assert.equal(Entry.availability(1),'low');assert.equal(Entry.availability(0),'out');assert.equal(Entry.availability(undefined,false),'unknown');
 const before={stock:{Tej:2,Tojás:4},cart:[{name:'Tej',quantity:2,recipeNeeds:[{recipe:{title:'Palacsinta'}}]}],custom:[],history:[{id:'kept'}],likes:['a']};
 const next=Entry.availabilityPlan(before,'Tej',1);assert.equal(before.stock.Tej,2);assert.equal(next.stock.Tej,1);assert.equal(next.stock.Tojás,4);assert.equal(next.cart,before.cart);assert.equal(next.history,before.history);assert.equal(next.likes,before.likes);assert.throws(()=>Entry.availabilityPlan(before,'__proto__',1));
});
test('restocking a low item marks it available without changing unrelated quantities or recipe metadata',()=>{
 const Voice=require('../voice-model.js'),Shared=require('../household-model.js'),before={...seed(),stock:{Tej:1,Tojás:4}};
 const quick=plan(before,['Tej'],'stock');assert.equal(quick.next.stock.Tej,2);assert.equal(quick.next.stock.Tojás,4);assert.deepEqual(quick.next.cart,before.cart);
 const voice=Voice.plan(before,[{action:'stock_add',name:'Tej',quantity:null,unit:null}],catalog,()=> 'db');assert.equal(voice.next.stock.Tej,2);assert.equal(voice.next.stock.Tojás,4);
 const low=Entry.availabilityPlan(before,'Tej',1);assert.equal(Shared.decode([...Shared.encode(low).values()],before).stock.Tej,1);
});
