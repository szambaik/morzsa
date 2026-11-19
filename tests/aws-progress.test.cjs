const {test}=require('node:test'),assert=require('node:assert/strict');
test('rapid provider tokens are coalesced and flush preserves the final answer and recipe',async()=>{
 const {createProgressWriter}=await import('../aws/backend/progress.mjs');const writes=[];
 const writer=createProgressWriter(async snapshot=>{writes.push(snapshot)},10000);
 writer.answer('S');
 for(let i=0;i<100;i++){writer.answer('Szia '+i);writer.recipes([{title:'Recept '+i,minutes:15}])}
 await writer.flush();
 assert.equal(writes.length,2);assert.equal(writes[0].answer,'S');
 assert.deepEqual(writes[1],{answer:'Szia 99',recipes:[{title:'Recept 99',minutes:15}]});
});
test('first text and its timing are published together and unchanged snapshots do not write again',async()=>{const {createProgressWriter}=await import('../aws/backend/progress.mjs'),writes=[];const writer=createProgressWriter(async v=>writes.push(v),10000);writer.answer('Szia',{firstTextMs:120});await writer.flush();assert.equal(writes.length,1);assert.equal(writes[0].answer,'Szia');assert.equal(writes[0].telemetry.firstTextMs,120);writer.answer('Szia',{firstTextMs:120});await writer.flush();assert.equal(writes.length,1)});
