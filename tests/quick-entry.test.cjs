const test=require('node:test'),assert=require('node:assert/strict'),q=require('../quick-entry.js');
const items=['Krumpli','Paradicsom','Tej','Tojás','Liszt','Vaj','Hagyma'].map(name=>({name})),en={'Tojás':'Egg','Krumpli':'Potato','Tej':'Milk'};
test('Exact, accents, English and common synonyms',()=>{for(const [input,want] of [['tojas','Tojás'],['MILK','Tej'],['burgonya','Krumpli'],['eggs','Tojás'],['paradicsm','Paradicsom']])assert.equal(q.match(input,items,en),want)});
test('Uncertain names are preserved, not forced into the catalog',()=>{assert.equal(q.match('Te',items,en),'Te');assert.equal(q.match('kedvenc kekszem',items,en),'kedvenc kekszem');assert.equal(q.match('alma',[{name:'Alma1'},{name:'Alma2'}]),'alma')});
test('Prefix suggestions do not imply automatic matching',()=>{assert.equal(q.ranked('par',items,en)[0].item.name,'Paradicsom');assert.equal(q.match('par',items,en),'par')});
