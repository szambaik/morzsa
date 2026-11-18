const {test}=require('node:test'),assert=require('node:assert/strict');
test('an AI result survives a concurrent save without calling the provider twice',async()=>{
 const {retryConflict}=await import('../aws/backend/retry.mjs');
 let providerCalls=0,stored={revision:1,other:'original'},attempts=0;
 const answer=await (async()=>{providerCalls++;return 'validated answer'})();
 await retryConflict(async()=>{
  const snapshot={...stored};attempts++;
  if(attempts===1)stored={revision:2,other:'concurrent change'};
  if(snapshot.revision!==stored.revision)throw Object.assign(Error('Conflict'),{status:409,retryable:true});
  stored={...snapshot,revision:snapshot.revision+1,answer};
 });
 assert.equal(providerCalls,1);assert.equal(attempts,2);
 assert.deepEqual(stored,{revision:3,other:'concurrent change',answer:'validated answer'});
});
test('authorization, duplicate requests and provider failures are not retried',async()=>{
 const {retryConflict}=await import('../aws/backend/retry.mjs');
 for(const failure of [{status:403},{status:409},{status:503,retryable:true}]){
  let attempts=0;const error=Object.assign(Error('Denied'),failure);
  await assert.rejects(retryConflict(async()=>{attempts++;throw error}),e=>e===error);
  assert.equal(attempts,1);
 }
});
test('persistent conflicts stop after four attempts',async()=>{
 const {retryConflict}=await import('../aws/backend/retry.mjs');let attempts=0;
 await assert.rejects(retryConflict(async()=>{attempts++;throw Object.assign(Error('Conflict'),{status:409,retryable:true})}));
 assert.equal(attempts,4);
});
test('DynamoDB transaction cancellation retries without repeating generation',async()=>{
 const {retryConflict}=await import('../aws/backend/retry.mjs');let attempts=0;
 const output={answer:'already generated'};
 const saved=await retryConflict(async()=>{
  if(++attempts===1)throw Object.assign(Error('Transaction canceled'),{name:'TransactionCanceledException',CancellationReasons:[{Code:'None'},{Code:'TransactionConflict'}]});
  return output;
 });
 assert.equal(saved,output);assert.equal(attempts,2);
});
