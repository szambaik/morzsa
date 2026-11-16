const test=require('node:test'),assert=require('node:assert/strict'),M=require('../kitchen-model');
const recipe=(id,minutes=40,names=['Tej','Liszt'],tags=[])=>({id,title:id,minutes,tags,ingredients:names.map(name=>({name,amount:'100 g'}))});
test('discovery never invents pantry or favourite sections for an empty or stale household',()=>{
 const list=[recipe('a',20),recipe('b',25),recipe('dessert',10,['Liszt'],['édes'])];
 const groups=M.discoverySections(list);assert.deepEqual(groups.map(g=>g.key),['quick','more']);
 const stale=M.discoverySections(list,{stock:{Tej:2,Liszt:2},uncertain:['Tej','Liszt']});assert.deepEqual(stale.map(g=>g.key),['quick','more']);
 assert.deepEqual(M.discoverySections([]),[]);
});
test('personal sections require confirmed coverage or actual preferences, reserve real favourites and deduplicate',()=>{
 const list=[recipe('liked',25),...['a','b','c','d'].map(id=>recipe(id)),recipe('liked',25)];
 const groups=M.discoverySections(list,{stock:{Tej:2,Liszt:2},favourites:['liked']});
 assert.deepEqual(groups.map(g=>g.key),['today','pantry','favourites']);
 const ids=groups.flatMap(g=>g.recipes.map(r=>r.id));assert.equal(ids.length,new Set(ids).size);assert.deepEqual(groups.find(g=>g.key==='favourites').recipes.map(r=>r.id),['liked']);
 const prefs=M.discoverySections([recipe('a',20),recipe('b',20)],{prefs:{maxMinutes:25}});assert.equal(prefs[0].key,'today');
});
test('sections respect excluded foods and distinguish absent from unknown ingredients',()=>{
 const groups=M.discoverySections([recipe('avoid',20,['Tej']),recipe('safe',20,['Rizs']),recipe('slow',50,['Rizs'])],{prefs:{avoid:['Tej'],maxMinutes:25},favourites:['avoid']});
 assert.deepEqual(groups.flatMap(g=>g.recipes.map(r=>r.id)),['safe']);
 const c=M.recipeChoice(recipe('r',20,['Tej','Liszt','Rizs']),{Tej:0,Liszt:2},['Liszt']);assert.deepEqual(c.out,['Tej']);assert.deepEqual(c.unknown,['Liszt','Rizs']);assert.equal(c.confirmed,0);
});
