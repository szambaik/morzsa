const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../companion-model.js'),R=require('../recipe-room-model.js');
const now=new Date(2026,10,12,12).getTime(),yesterday=new Date(2026,10,11,23,59).getTime();
test('daily chat migration preserves undated history, original saves and more than 40 main messages',()=>{
 const old={version:2,threads:[{id:'main',kind:'main',messages:Array.from({length:80},(_,i)=>({role:'user',text:String(i)}))}]},original=JSON.stringify(old);
 const migrated=M.workspace(old,R.recipe,now);assert.equal(migrated.threads[0].messages.length,80);assert.equal(JSON.stringify(old),original);assert.deepEqual(M.workspace(migrated,R.recipe,now),migrated);
 assert.equal(M.dayGroups(migrated.threads[0].messages,now)[0].day,'undated');assert.equal(M.currentMessages(migrated.threads[0],now).length,0);
 assert.notEqual(M.workspaceKey('u','h','hu'),M.previousWorkspaceKey('u','h','hu'));
});
test('today is isolated from past days and manual archives while render indices remain stable',()=>{
 let book=M.workspace(null,R.recipe,now);book.threads[0].messages=[{role:'user',text:'unknown'},{role:'model',text:'yesterday',createdAt:yesterday},{role:'user',text:'today',createdAt:now}];
 const groups=M.dayGroups(book.threads[0].messages,now);assert.deepEqual(groups.find(g=>g.current).items.map(i=>i.index),[2]);
 assert.deepEqual(M.currentMessages(book.threads[0],now).map(m=>m.text),['today']);
 const archived=M.archiveMain(book,R.recipe,now);assert.deepEqual(M.archiveMain(archived,R.recipe,now),archived);assert.equal(M.currentMessages(archived.threads[0],now).length,0);assert.equal(book.threads[0].messages[2].archived,undefined);
 archived.threads[0].messages.push({role:'user',text:'new start',createdAt:now+1});assert.deepEqual(M.currentMessages(archived.threads[0],now).map(m=>m.text),['new start']);assert.equal(archived.threads[0].messages.length,4);
 assert.equal(M.currentMessages({...book.threads[0],kind:'recipe'},now).length,3);
});
test('midnight and DST use local calendar days, invalid timestamps stay undated',()=>{
 const old=process.env.TZ;process.env.TZ='Europe/Budapest';try{
  assert.equal(M.dayKey(Date.parse('2026-10-25T00:30:00Z')),M.dayKey(Date.parse('2026-10-25T01:30:00Z')));
  assert.notEqual(M.dayKey(Date.parse('2026-11-11T22:59:59Z')),M.dayKey(Date.parse('2026-11-11T23:00:00Z')));
  assert.equal(M.dayKey(NaN),'undated');assert.equal(M.dayKey(1e99),'undated');
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old}
});
