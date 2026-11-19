const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const inspect=origin=>spawnSync(process.execPath,['--input-type=module','-e',"import {allowedOrigins,webCallbacks} from './aws/backend/origins.mjs'; console.log(JSON.stringify({allowedOrigins,webCallbacks}))"],{cwd:process.cwd(),encoding:'utf8',env:{...process.env,FRONTEND_ORIGIN:origin||''}});
test('the configured CloudFront origin is additive and other distributions stay untrusted',()=>{
 const original=JSON.parse(inspect('').stdout),added=inspect('https://dexample.cloudfront.net');assert.equal(added.status,0);
 const value=JSON.parse(added.stdout);
 for(const origin of original.allowedOrigins)assert.ok(value.allowedOrigins.includes(origin));
 for(const callback of original.webCallbacks)assert.ok(value.webCallbacks.includes(callback));
 assert.ok(value.allowedOrigins.includes('https://dexample.cloudfront.net'));
 assert.ok(value.webCallbacks.includes('https://dexample.cloudfront.net/'));
 assert.ok(!value.allowedOrigins.includes('https://different.cloudfront.net'));
});
test('frontend configuration rejects paths and insecure origins',()=>{
 for(const origin of ['http://dexample.cloudfront.net','https://dexample.cloudfront.net/path','https://dexample.cloudfront.net/'])assert.notEqual(inspect(origin).status,0);
});
