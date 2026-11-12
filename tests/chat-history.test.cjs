const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../companion-model'),R=require('../recipe-room-model');
const recipe={title:'Palacsinta',summary:'Gyors.',minutes:20,ingredients:[{name:'Tej',amount:'250 ml'}],steps:['Süsd meg.']};
test('v4 migration keeps v3 daily history, active recipe and all original data',()=>{
 const old={version:3,active:'recipe',threads:[{id:'main',kind:'main',updated:1,messages:Array.from({length:80},(_,i)=>({role:'user',text:String(i)}))},{id:'recipe',kind:'recipe',recipe,status:'completed',cookingStep:0,messages:[{role:'user',text:'Finom lett.'}]}]},before=JSON.stringify(old);
 const b=M.workspace(old,R.recipe,100);assert.equal(JSON.stringify(old),before);assert.equal(b.active,'recipe');assert.equal(b.threads[0].messages.length,80);assert.equal(M.historyGroups(b).recipes.length,1);assert.equal(b.threads[1].status,'completed');assert.deepEqual(M.workspace(b,R.recipe),b);
 assert.notEqual(M.workspaceKey('u','h','hu'),M.dailyWorkspaceKey('u','h','hu'));
});
test('new chats isolate model history and repeated saves preserve their kind and active selection',()=>{
 let b=M.workspace(null,R.recipe,1);b.threads[0].messages=[{role:'user',text:'Régi beszélgetés',createdAt:1}];
 const before=JSON.stringify(b);b=M.startChat(b,'new',R.recipe,2);assert.equal(b.active,'new');assert.equal(b.threads[1].kind,'chat');assert.equal(b.threads[1].messages.length,0);
 b.threads[1].messages.push({role:'user',text:'Másik kérdés',createdAt:3});const restored=M.workspace(JSON.parse(JSON.stringify(b)),R.recipe);
 assert.equal(restored.active,'new');assert.equal(restored.threads[1].kind,'chat');assert.deepEqual(M.history(M.currentMessages(restored.threads[1],100)).map(m=>m.text),['Másik kérdés']);assert.notEqual(JSON.stringify(b),before);
 assert.throws(()=>M.startChat(b,'new',R.recipe),/DUPLICATE_THREAD/);
});
test('five recent chats, older archive and all recipe sessions are disjoint without deleting anything',()=>{
 let b=M.workspace(null,R.recipe,1);for(let i=0;i<7;i++)b=M.startChat(b,'chat'+i,R.recipe,i+2);
 b=M.startRecipe(b,recipe,'cook1',R.recipe,12);b=M.finishRecipe(b,'cook1',R.recipe,'Done: ',13);b=M.startRecipe(b,recipe,'cook2',R.recipe,14);
 const before=JSON.stringify(b),groups=M.historyGroups(b);assert.equal(groups.recent.length,5);assert.equal(groups.archive.length,3);assert.equal(groups.recipes.length,2);assert.equal(JSON.stringify(b),before);
 assert.equal(new Set([...groups.recent,...groups.archive,...groups.recipes].map(t=>t.id)).size,b.threads.length);
 assert.equal(groups.recipes.filter(t=>t.status==='completed').length,1);
});
test('manual archiving and restoration are repeatable and keep messages and recipe parents',()=>{
 let b=M.startChat(M.workspace(null,R.recipe,1),'new',R.recipe,2);b.threads[1].messages=[{role:'user',text:'Maradjon meg.',createdAt:3}];
 const before=JSON.stringify(b),archived=M.archiveThread(b,'new',R.recipe,true,4);assert.equal(JSON.stringify(b),before);assert.deepEqual(M.archiveThread(archived,'new',R.recipe,true,5),archived);assert.equal(M.historyGroups(archived).archive[0].id,'new');
 b=M.archiveThread(archived,'new',R.recipe,false,6);assert.equal(b.threads[1].messages[0].text,'Maradjon meg.');assert.deepEqual(M.archiveThread(b,'new',R.recipe,false,7),b);
 b=M.startRecipe(b,recipe,'cook',R.recipe,8);assert.equal(b.threads[1].parentId,'new');b=M.finishRecipe(JSON.parse(JSON.stringify(b)),'cook',R.recipe,'Done: ',9);
 assert.equal(b.threads.find(t=>t.id==='new').messages.length,2);assert.equal(b.threads[0].messages.length,0);
});
