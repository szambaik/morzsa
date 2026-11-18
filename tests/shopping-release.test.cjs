const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Quick=require('../quick-entry'),Ingredients=require('../ingredient-model'),Quantity=require('../quantity-model'),Prices=require('../shopping-price-model'),Workspace=require('../workspace-entry'),Store=require('../shopping-mode-model'),Voice=require('../voice-model'),Recipes=require('../recipe-shopping'),Household=require('../household-model');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('catalog.js','utf8')+fs.readFileSync('translations.js','utf8')+';globalThis.data={catalog,productEnglish};',ctx);
const {catalog,productEnglish}=ctx.data,I=Ingredients.create(catalog,productEnglish),unit=n=>I.key(n)===I.key('Tej')?'l':'kg';
const source=()=>({stock:{},cart:[],custom:[],likes:['kept'],history:[{id:'old'}],chats:{old:'kept'},legacy:{keep:true}});
const recipe={title:'Krumplis teszt',summary:'Próba',servings:2,minutes:20,ingredients:[{name:'burgonya',amount:'500 g'}],steps:['Főzd meg.']};
test('explicit HU/EN aliases and accents share identity; dietary and preparation variants remain distinct',()=>{
 for(const name of ['burgonya','BURGONYÁK','potato','potatoes','  krumpli  '])assert.equal(I.resolve(name),'Krumpli');
 assert.equal(I.resolve('eggs'),'Tojás');assert.equal(I.resolve('zabtej'),'Zabital');
 for(const pair of [['Tej','Laktózmentes tej'],['Tej','Zabital'],['Borsó','Fagyasztott borsó'],['Hagyma','Lilahagyma'],['Alma','Almalé'],['répa','Sárgarépa']])assert.notEqual(I.key(pair[0]),I.key(pair[1]));
 assert.equal(I.resolve('Saját krumplis étel'),'Saját krumplis étel');
});
test('explicit aliases outrank old custom alias records without fuzzy saved-record merging',()=>{
 const products=[...catalog,{name:'burgonya',category:'Saját tételek'}],identity=Ingredients.create(products,productEnglish);
 assert.equal(Quick.match('burgonya',products,productEnglish),'Krumpli');assert.equal(identity.resolve('burgonya'),'Krumpli');
 assert.notEqual(I.key('Tejj'),I.key('Tej'));assert.equal(I.target('potatoes',['burgonya']),'burgonya');
});
test('manual and store additions reuse old alias keys, preserve metadata and are repeatable',()=>{
 const before={...source(),cart:[{name:'burgonya',quantity:500,unit:'g',done:false,notes:'Partner note',recipeNeeds:[{keep:true}]}],custom:[{name:'burgonya',emoji:'🥔',category:'Saját tételek'}]};
 const plan=Workspace.plan(before,['Krumpli','potatoes'],'cart',catalog,unit,Quick.norm,I.key);
 assert.deepEqual(plan.next,before);assert.equal(plan.next.cart.length,1);
 const stored=Store.add(plan.next,['potatoes'],{resolve:I.resolve,identify:I.key,unitFor:unit,known:catalog,sessionId:'shop',actor:'partner',now:'today'});
 assert.equal(stored.cart.length,1);assert.equal(stored.cart[0].name,'burgonya');assert.equal(stored.cart[0].quantity,500);assert.equal(stored.cart[0].notes,'Partner note');
 assert.deepEqual(Store.add(stored,['Krumpli'],{resolve:I.resolve,identify:I.key,unitFor:unit,known:catalog,sessionId:'shop',actor:'partner',now:'today'}),stored);
});
test('voice and recipe paths reuse existing alias totals and preserve recipe links',()=>{
 const before={...source(),cart:[{name:'burgonya',quantity:750,unit:'g',done:false,source:'Manual',notes:'Keep'}],stock:{burgonya:1}};
 const ops=Voice.resolve({transcript:'',clarification:'',operations:[{action:'list_set',name:'potatoes',quantity:2,unit:'kg'}]},catalog,productEnglish,Quick,before);
 assert.equal(ops[0].name,'burgonya');assert.equal(Voice.plan(before,ops,catalog,unit).next.cart.length,1);
 const added=Recipes.plan(before,recipe,I.resolve,unit,['Krumpli'],null,I.key);assert.equal(added.next.cart.length,1);assert.equal(added.next.cart[0].quantity,750);assert.equal(added.next.cart[0].notes,'Keep');
 assert.equal(Recipes.plan(added.next,recipe,I.resolve,unit,['potatoes'],null,I.key).linked,0);
 assert.equal(Recipes.plan(before,recipe,I.resolve,unit,null,null,I.key).added,0);
 assert.equal(Recipes.purchase(before,{name:'potatoes',amount:'2 kg'},I.resolve,unit,I.key).quantity,750);
});
test('category hints recognize branded items but never canonicalize them',()=>{
 for(const [name,category] of [['burgonya','Zöldségek'],['Mizo tej','Tejtermék és tojás'],['Barilla penne','Rizs és tészta'],['Saját jegyzet','Saját tételek']])assert.equal(I.category(name),category);
 assert.equal(I.resolve('Mizo tej'),'Mizo tej');
});
test('explicit pantry import reuses existing alias keys and remains idempotent',()=>{
 const target={...source(),stock:{burgonya:1,Tej:2}},imported={stock:{Krumpli:2,Tojás:2},custom:[]};
 const first=Household.pantryImportPlan(imported,target,catalog,I.key);assert.equal(first.next.stock.burgonya,1);assert.equal(first.next.stock.Krumpli,undefined);assert.equal(first.next.stock.Tojás,2);assert.deepEqual(first.next.legacy,target.legacy);
 assert.deepEqual(Household.pantryImportPlan(imported,first.next,catalog,I.key).next,first.next);
});
test('explicit stock consolidation keeps approximate maximum and all unrelated old-save fields',()=>{
 const before={...source(),stock:{burgonya:1,Krumpli:5,Alma:2},custom:[{name:'burgonya',emoji:'🥔',category:'Saját tételek'}]},snapshot=JSON.stringify(before),plan=I.consolidate(before,'stock');
 assert.equal(JSON.stringify(before),snapshot);assert.equal(plan.merged.length,1);
 const latest={...before,stock:{...before.stock,Tej:2}},next=I.apply(latest,plan);
 assert.deepEqual(next.stock,{Krumpli:5,Alma:2,Tej:2});assert.deepEqual(next.custom,before.custom);assert.deepEqual(next.legacy,before.legacy);
 assert.equal(I.consolidate(next,'stock').changes.length,0);assert.equal(I.apply(next,plan),null);
});
test('cart consolidation converts compatible units and rejects stale affected values atomically',()=>{
 const before={...source(),cart:[{name:'burgonya',quantity:500,unit:'g',done:false,source:'Manual',notes:'Keep'},{name:'Krumpli',quantity:2,unit:'kg',done:false,source:'Manual',notes:'Keep'},{name:'Alma',quantity:1,unit:'kg',done:false}]},plan=I.consolidate(before,'cart',{unitFor:unit});
 const next=I.apply({...before,cart:[...before.cart,{name:'Tej',quantity:1,unit:'l'}]},plan);assert.equal(next.cart.find(i=>i.name==='Krumpli').quantity,2.5);assert.equal(next.cart.find(i=>i.name==='Krumpli').unit,'kg');assert.equal(next.cart.length,3);
 const partner={...before,cart:before.cart.map(i=>i.name==='Krumpli'?{...i,notes:'Changed'}:i)};assert.equal(I.apply(partner,plan),null);assert.equal(partner.cart.length,3);
 const reverse={changes:plan.changes.map(c=>({...c,before:c.after,after:c.before}))};assert.deepEqual(I.apply(next,reverse).cart.filter(i=>i.name!=='Tej').sort((a,b)=>a.name.localeCompare(b.name)),before.cart.slice().sort((a,b)=>a.name.localeCompare(b.name)));
});
test('incompatible units, notes, recipe metadata, purchase state and ambiguous duplicate keys remain separate',()=>{
 for(const fields of [{unit:'db'},{notes:'Different'},{done:true},{recipeNeeds:[{recipe:'other'}]},{quantity:1000}]){const rows=[{name:'Krumpli',quantity:1,unit:'kg',done:false},{name:'burgonya',quantity:1,unit:'kg',done:false,...fields}],plan=I.consolidate({...source(),cart:rows},'cart');assert.equal(plan.changes.length,0);assert.equal(plan.skipped.length,1)}
 assert.equal(I.consolidate({...source(),cart:[{name:'Tej'},{name:'Tej'}]},'cart').changes.length,0);
});
test('separate addition sources and actors survive consolidation as provenance',()=>{
 const before={...source(),cart:[{name:'burgonya',quantity:500,unit:'g',done:false,source:'Voice',addedBy:'a',addedAt:'earlier'},{name:'Krumpli',quantity:1,unit:'kg',done:false,source:'Manual',addedBy:'b',addedAt:'later'}]},plan=I.consolidate(before,'cart'),next=I.apply(before,plan),item=next.cart[0];
 assert.equal(item.name,'Krumpli');assert.equal(item.quantity,1.5);assert.equal(item.addedBy,'b');assert.equal(item.source,'Manual');assert.equal(item.ingredientAliases.length,2);assert.equal(item.ingredientAliases.find(o=>o.name==='burgonya').addedBy,'a');assert.equal(item.ingredientAliases.find(o=>o.name==='burgonya').source,'Voice');
 const reordered={...next,cart:next.cart.map(i=>({...i,ingredientAliases:i.ingredientAliases.map(o=>Object.fromEntries(Object.entries(o).reverse()))}))},reverse={changes:plan.changes.map(c=>({...c,before:c.after,after:c.before}))};assert(I.apply(reordered,reverse),'jsonb key ordering must not block Undo');
});
test('quick quantity boundaries convert g/ml while field guards preserve partner notes and reject amount races',()=>{
 assert.deepEqual(Quantity.adjust(950,'g',1),{quantity:1,unit:'kg'});assert.deepEqual(Quantity.adjust(900,'ml',1),{quantity:1,unit:'l'});assert.equal(Quantity.adjust(1,'db',-1),null);assert.equal(Quantity.adjust(999,'db',1),null);
 const before={...source(),cart:[{name:'Tej',quantity:1,unit:'l',done:false,notes:'Before'}]},next={...before,cart:[{...before.cart[0],quantity:2}]},intent=Household.cartIntent(before,next);intent.cart[0].when={quantity:1,unit:'l'};
 const latest={...before,cart:[{...before.cart[0],notes:'Partner'}]};assert.equal(Household.applyCartIntents(latest,[intent]).cart[0].notes,'Partner');assert.equal(Household.applyCartIntents({...latest,cart:[{...latest.cart[0],quantity:3}]},[intent]).cart[0].quantity,3);
});
test('KSH price mappings refer to actual catalog products and explicit valid source bases',()=>{
 assert.equal(Object.keys(Prices.source.products).length,65);for(const [name,data] of Object.entries(Prices.source.products)){assert(catalog.some(i=>i.name===name),name);assert(data.mean>0,name);assert(data.sourceCode&&data.sourceLabel,name);assert(['kg','l','db','g'].includes(data.basis.unit),name)}
 assert.equal(Prices.source.year,2025);assert.deepEqual(Prices.source.rangeFactor,[.7,1.3]);
});
test('price conversion, package assumptions and incomplete totals stay explicit',()=>{
 const opts={resolve:I.resolve,unitFor:unit};assert.equal(Prices.estimate({name:'eggs',quantity:10,unit:'db'},opts).mean,900);assert.equal(Prices.estimate({name:'burgonya',quantity:500,unit:'g'},opts).mean,193);
 const butter=Prices.estimate({name:'Vaj',quantity:2,unit:'csomag'},opts);assert.equal(butter.mean,1128);assert.deepEqual(butter.assumption,{quantity:100,unit:'g',per:'csomag'});
 assert.equal(Prices.estimate({name:'Tej',quantity:1,unit:'db'},opts).known,false);assert.equal(Prices.estimate({name:'Saját tétel'},opts).known,false);assert.equal(Prices.estimate({name:'Laktózmentes tej',quantity:1,unit:'l'},opts).known,false);
 const list=[{name:'Tej',quantity:1,unit:'l'},{name:'Ismeretlen',quantity:1,unit:'db'}],total=Prices.total(list,opts);assert.equal(total.known,1);assert.equal(total.missing,1);assert.equal(total.low,300);assert.equal(total.high,580);assert.equal(Prices.total([{...list[0],quantity:2}],opts).high,1150);
});
