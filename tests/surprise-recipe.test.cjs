const {test}=require('node:test'),assert=require('node:assert/strict'),{choose}=require('../surprise-recipe.js');
const recipes=[{id:'milk',time:10,ingredients:[['Tej','1']]},{id:'egg',time:15,ingredients:[['Tojás','1']]},{id:'both',time:20,ingredients:[['Tej','1'],['Tojás','1']]}];
test('surprise prioritizes the actual pantry and leaves it untouched',()=>{const stock={Tej:2,Tojás:0};const before=JSON.stringify(stock);assert.equal(choose(recipes,stock,[],()=>0).id,'milk');assert.equal(JSON.stringify(stock),before)});
test('surprise varies candidates before repeating and handles an empty pantry',()=>{const a=choose(recipes,{},[],()=>0);const b=choose(recipes,{},[a.id],()=>0);assert.notEqual(a.id,b.id);assert.notEqual(choose(recipes,{},['milk','egg','both'],()=>.99).id,'both')});
test('surprise supports a single match or no recipes',()=>{assert.equal(choose([],{}),null);assert.equal(choose(recipes,{Tej:2},['milk']).id,'milk')});
