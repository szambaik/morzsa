const test=require('node:test'),assert=require('node:assert/strict'),C=require('../recipe-crafting'),M=require('../recipe-room-model');
test('bowl selection toggles only allowed ingredients, caps at six, and does not mutate input',()=>{const allowed=['a','b','c','d','e','f','g'];let selected=[];for(const name of allowed)selected=C.toggle(selected,name,allowed);assert.equal(selected.length,6);assert.deepEqual(C.toggle(selected,'soap',allowed),selected);const before=[...selected];assert.equal(C.toggle(selected,'b',allowed).length,5);assert.deepEqual(selected,before);assert.deepEqual(C.toggle(C.toggle([], 'a',allowed),'a',allowed),[])});
test('discovery distinguishes selected inspiration from actual pantry and leaves household data untouched',()=>{const stock={Tojás:2,Liszt:0},copy=JSON.stringify(stock),prompt=C.prompt(['Tojás','Liszt','Tojás'],stock,'en',{Tojás:'Eggs',Liszt:'Flour'});assert(prompt.includes('"name":"Eggs","atHome":true'));assert(prompt.includes('"name":"Flour","atHome":false'));assert.equal(prompt.split('"name":"Eggs"').length,2);assert(prompt.includes('every required ingredient'));assert.equal(JSON.stringify(stock),copy);assert.equal(C.prompt([],stock),'');assert(C.prompt(Array(6).fill('x'.repeat(80)),{}).length<2000)});
test('compact crafting messages preserve full recipe instructions for retries and follow-ups',()=>{const request=C.prompt(['Tojás'],{Tojás:2});const messages=M.messages([{role:'user',text:'Kotyvasszunk: Tojás',request,recipes:[]}]);assert.equal(messages[0].text,'Kotyvasszunk: Tojás');assert.equal(messages[0].request,request);assert.equal(M.history(messages)[0].text,request);assert(!M.messages([{role:'model',text:'hello',request:'untrusted'}])[0].request);assert(!M.messages([{role:'user',text:'hello',request:'x'.repeat(2001)}])[0].request)});

test('chat crafting receipt is compact while full instructions survive ordinary conversation persistence',()=>{const Companion=require('../companion-model'),request=C.prompt(['Tojás','Liszt'],{Tojás:2,Liszt:0}),receipt=C.receipt(request);assert.equal(receipt,'Kotyvasszunk: Tojás + Liszt');const book=Companion.normalize({threads:[{id:'test',messages:[{role:'user',text:request,recipes:[]}]}]});assert.equal(book.threads[0].messages[0].text,request);assert.equal(Companion.history(book.threads[0].messages)[0].text,request);assert.equal(C.receipt(C.prompt(['Tojás'],{Tojás:2},'en',{Tojás:'Eggs'}),'en'),'Mix & discover: Eggs');for(const text of ['hello','Kiválasztott hozzávalók: []',request+'junk',request.replace('"atHome":true','"atHome":"true"'),request.replace('"name":"Tojás"','"name":""')])assert.equal(C.receipt(text),null)});

test('six distinct long names fit the persisted request in both languages',()=>{
 const names=Array.from({length:6},(_,i)=>String(i)+'x'.repeat(79));
 for(const language of ['hu','en']){const prompt=C.prompt(names,{},language);assert(prompt.length<=2000);assert.deepEqual(C.selection(prompt).map(i=>i.name),names)}
});
test('discovery collection contains only valid recipe responses to crafting, never ordinary or read-only shared replies',()=>{
 const recipe={title:'Palacsinta',summary:'Gyors reggeli.',minutes:20,servings:2,ingredients:[{name:'Tojás',amount:'2 db'}],steps:['Keverd össze és süsd meg.']};
 const messages=[{role:'model',recipes:[recipe]},{role:'user',text:C.prompt(['Tojás'],{})},{role:'model',text:'Nem működik.',recipes:[]},{role:'model',recipes:[recipe,{title:'Hiányos'}]},{role:'user',text:'Más téma.'},{role:'model',recipes:[recipe]}];
 const book={threads:[{id:'own',messages},{id:'shared',readOnly:true,messages}]},before=JSON.stringify(book),found=C.discoveries(book,M.recipe);
 assert.equal(found.length,1);assert.equal(found[0].threadId,'own');assert.deepEqual(found[0].ingredients,['Tojás']);assert.equal(JSON.stringify(book),before);
 assert.equal(C.discoveries({threads:[{messages:messages.slice(0,3)}]},M.recipe).length,0);
});
test('known combinations ignore selection order, accents and aliases without confusing different ingredients',()=>{
 const resolve=n=>n==='Eggs'?'Tojás':n;
 assert.equal(C.combination(['Liszt','Tojás','Liszt'],resolve),C.combination(['Eggs','LISZT'],resolve));
 assert.notEqual(C.combination(['Liszt','Tojás']),C.combination(['Liszt','Tej']));
});
