const test=require('node:test'),assert=require('node:assert/strict'),q=require('../quick-entry.js');
const items=['Krumpli','Paradicsom','Tej','Tojás','Liszt','Vaj','Hagyma'].map(name=>({name})),en={'Tojás':'Egg','Krumpli':'Potato','Tej':'Milk'};
test('Exact, accents, English and common synonyms',()=>{for(const [input,want] of [['tojas','Tojás'],['MILK','Tej'],['burgonya','Krumpli'],['eggs','Tojás'],['paradicsm','Paradicsom']])assert.equal(q.match(input,items,en),want)});
test('Uncertain names are preserved, not forced into the catalog',()=>{assert.equal(q.match('Te',items,en),'Te');assert.equal(q.match('kedvenc kekszem',items,en),'kedvenc kekszem');assert.equal(q.match('alma',[{name:'Alma1'},{name:'Alma2'}]),'alma')});
test('Prefix suggestions do not imply automatic matching',()=>{assert.equal(q.ranked('par',items,en)[0].item.name,'Paradicsom');assert.equal(q.match('par',items,en),'par')});
test('render matcher indexes exact names and aliases once, preserves ambiguous input, and rebuilds for changed data',()=>{
 let reads=0;const products=Array.from({length:1000},(_,i)=>({get name(){reads++;return 'Termék '+i}}));products.push({name:'Tojás'},{name:'Alma1'},{name:'Alma2'});
 const resolve=q.matcher(products,{'Tojás':'Egg'}),built=reads;
 for(let i=0;i<100;i++){assert.equal(resolve('termek 999'),'Termék 999');assert.equal(resolve('eggs'),'Tojás');assert.equal(resolve('EGG'),'Tojás')}
 assert.equal(reads,built,'Exact matches must not rescan the catalog');assert.equal(resolve('alma'),'alma');
 assert.equal(q.matcher([{name:'New product'}])('New product'),'New product');
});
