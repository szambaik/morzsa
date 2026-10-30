const {test}=require('node:test'),assert=require('node:assert/strict'),VM=require('../voice-model'),QE=require('../quick-entry'),HM=require('../household-model');
const items=[{name:'Tej',category:'Tejtermék és tojás'},{name:'Vaj'},{name:'Krumpli'}],unit=()=> 'db';
const base=()=>({stock:{Vaj:2},cart:[{name:'Krumpli',quantity:5,unit:'kg',done:false}],custom:[],likes:['r1'],skips:[],history:[{id:'keep'}],chats:{private:'keep'},sortMode:'alpha'});
const op=(action,name,quantity=null,unit=null)=>({action,name,quantity,unit});
test('voice validates constrained commands, rejects unsafe names and quantities',()=>{for(const o of [op('clear','Tej'),op('stock_add','__proto__'),op('list_set','Tej',-1),op('list_set','Tej',1,'bad')])assert.equal(VM.validate({transcript:'',clarification:'',operations:[o]}),false)});
test('voice resolves bilingual exact/alias names, requires review for uncertain products',()=>{const r=VM.resolve({transcript:'milk paprika burgonya',clarification:'',operations:[op('stock_add','milk'),op('stock_add','paprika'),op('stock_add','burgonya')]},items,{Tej:'Milk'},QE);assert.equal(r[0].name,'Tej');assert.equal(r[0].confirmed,true);assert.equal(r[1].confirmed,false);assert.equal(r[2].name,'Krumpli')});
test('mixed batch preserves unrelated old state and is idempotent',()=>{const original=base(),ops=[op('stock_add','Tej'),op('stock_remove','Vaj'),op('list_set','Krumpli',2,'kg'),op('stock_add','Saját termék')];const plan=VM.plan(original,ops,items,unit);assert.equal(original.stock.Tej,undefined);assert.equal(plan.next.stock.Tej,2);assert.equal(plan.next.stock.Vaj,0);assert.equal(plan.next.cart[0].quantity,2);assert.equal(plan.next.custom[0].category,'Saját tételek');for(const k of ['likes','history','chats','sortMode'])assert.deepEqual(plan.next[k],original[k]);assert.equal(VM.plan(plan.next,ops,items,unit).changes.length,0)});
test('undo changes only touched records and keeps later edits',()=>{const original=base(),plan=VM.plan(original,[op('stock_add','Tej'),op('stock_remove','Vaj'),op('list_set','Krumpli',2,'kg')],items,unit);plan.next.stock.Alma=2;plan.next.cart[0].quantity=3;const undo=VM.undo(plan.next,plan.changes);assert.equal(undo.next.stock.Tej,undefined);assert.equal(undo.next.stock.Vaj,2);assert.equal(undo.next.stock.Alma,2);assert.equal(undo.next.cart[0].quantity,3);assert.equal(undo.skipped,1)});
test('voice shared changes use existing per-record revisions and preserve unrelated rows',()=>{const s=base(),rows=[...HM.encode(s).values()].map(r=>({...r,revision:7}));const plan=VM.plan(s,[op('stock_remove','Vaj'),op('list_set','Krumpli',2,'kg')],items,unit),diff=HM.diff(rows,plan.next);assert.equal(diff.length,2);assert.ok(diff.every(d=>d.expected===7));assert.deepEqual(diff.map(x=>x.bucket).sort(),['cart','stock'])});

test('fractional weights and volumes remain compatible with existing shared minimum quantity',()=>{const plan=VM.plan(base(),[op('list_set','Krumpli',0.5,'kg'),op('list_set','Tej',0.2,'l')],items,unit);assert.equal(plan.next.cart[0].quantity,500);assert.equal(plan.next.cart[0].unit,'g');assert.equal(plan.next.cart[1].quantity,200);assert.equal(plan.next.cart[1].unit,'ml');assert.throws(()=>VM.plan(base(),[op('list_set','Tej',0.5,'doboz')],items,unit));});

test('name-only list requests default by product and preserve existing totals',()=>{
 const original=base(),unit=n=>n==='Tej'?'l':n==='Krumpli'?'kg':'db';
 const p=VM.plan(original,[op('list_set','Tej'),op('list_set','Krumpli'),op('list_set','Egyedi')],items,unit);
 assert.deepEqual(p.next.cart.map(i=>[i.name,i.quantity,i.unit]),[['Krumpli',5,'kg'],['Tej',1,'l'],['Egyedi',1,'db']]);
 assert.equal(VM.plan(p.next,[op('list_set','Tej')],items,unit).changes.length,0);
 const fractional=VM.plan(base(),[op('list_set','Tej',.5)],items,unit);assert.equal(fractional.next.cart[1].quantity,500);assert.equal(fractional.next.cart[1].unit,'ml');
 assert.equal(VM.defaults(op('list_set','Krumpli',null,'csomag'),original,unit).quantity,1);
});
