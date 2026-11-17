const {test}=require('node:test'),assert=require('node:assert/strict');
const rid='10000000-0000-4000-8000-000000000001',lease='20000000-0000-4000-8000-000000000002',uid='30000000-0000-4000-8000-000000000003',id='request-12345';
const keys=crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
async function signed(body={request_id:id,status:'OK',payload:{images:[{url:'http://localhost/never-download-this'}]}},extra={}){
 const pair=await keys,raw=JSON.stringify(body),timestamp=String(Math.floor(Date.now()/1000)),headers={'x-fal-webhook-request-id':id,'x-fal-webhook-user-id':'fal-account','x-fal-webhook-timestamp':timestamp,...extra};
 const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))).toString('hex');
 const message=[headers['x-fal-webhook-request-id'],headers['x-fal-webhook-user-id'],headers['x-fal-webhook-timestamp'],hash].join(String.fromCharCode(10));
 headers['x-fal-webhook-signature']=Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(message))).toString('hex');
 return new Request('https://cloud/functions/v1/recipe-image-webhook',{method:'POST',headers,body:raw});
}
async function harness({step=-1,hidden=false}={}){
 const {createHandler}=await import('../supabase/functions/recipe-image-webhook/handler.mjs');
 const config={url:'https://cloud',serviceKey:'service',falKey:'fal'},pair=await keys,jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
 let job={recipe_id:rid,step,lease,state:'pending',model:'fal-ai/flux-2/klein/4b',provider_request:{id,model:'fal-ai/flux-2/klein/4b',statusUrl:'https://queue.fal.run/fal-ai/flux-2/requests/'+id+'/status',resultUrl:'https://queue.fal.run/fal-ai/flux-2/requests/'+id,paidRequest:lease,userId:uid}},failUpload=false,failSave=false,failSettlement=false,terminal=false;
 const calls=[],objects=new Map(),payments=[];
 const fetcher=async(url,options={})=>{
  calls.push({url,options});const body=typeof options.body==='string'?JSON.parse(options.body):null;
  if(url==='https://rest.fal.ai/.well-known/jwks.json')return Response.json({keys:[jwk]});
  if(url.includes('/recipe_asset_jobs?')){
   if(options.method==='PATCH'){
    if(failSave)return new Response('',{status:503});
    if(new URL(url).searchParams.get('lease')!=='eq.'+job.lease||!['pending','uncertain'].includes(job.state))return Response.json([]);
    job={...job,...body};return Response.json([job]);
   }
   return Response.json(hidden?[]:[job]);
  }
  if(url.includes('/recipe_documents?'))return Response.json([{id:rid,published:false,content:{steps:['Mix the batter.','Bake the cake.']}}]);
  if(url.includes('/morzsa_plus_requests?')){if(failSettlement)return new Response('',{status:503});payments.push(body);return Response.json({})}
  if(url.endsWith('/status'))return Response.json({status:terminal?'FAILED':'COMPLETED'});
  if(url.startsWith('https://queue.fal.run/'))return Response.json({images:[{url:'https://v3.fal.media/finished.jpg'}]});
  if(url==='https://v3.fal.media/finished.jpg')return new Response(new Uint8Array([255,216,255,1]));
  if(url.includes('/storage/v1/object/')){
   assert.equal(options.method,'POST');if(failUpload)return new Response('',{status:503});
   if(objects.has(url))return new Response('',{status:409});objects.set(url,options.body);return Response.json({});
  }
  throw Error('Unexpected route '+url);
 };
 return {fn:createHandler(config,fetcher),fetcher,config,calls,objects,payments,get job(){return job},show(){hidden=false},failUpload(v){failUpload=v},failSave(v){failSave=v},failSettlement(v){failSettlement=v},terminal(){terminal=true},replaceLease(){job={...job,lease:'40000000-0000-4000-8000-000000000004',provider_request:{...job.provider_request,id:'request-replacement'}}}};
}
test('signed callbacks cache covers and individual steps without a browser, and repeated delivery reuses one object',async()=>{
 for(const step of [-1,0,1]){
  const h=await harness({step});assert.equal((await h.fn(await signed())).status,200);assert.equal(h.job.state,'ready');assert.equal(h.objects.size,1);assert.equal(h.job.asset_path,rid+'/'+step+'/'+lease+'.jpg');
  assert.ok([...h.objects.keys()][0].includes('/recipe-images/'));assert.equal(h.payments.at(-1).state,'complete');assert.equal(h.payments.at(-1).usage.estimatedCents,0.5);
  const providerCalls=h.calls.filter(c=>c.url.startsWith('https://queue.fal.run/')).length;
  assert.equal((await h.fn(await signed())).status,200);assert.equal(h.objects.size,1);assert.equal(h.calls.filter(c=>c.url.startsWith('https://queue.fal.run/')).length,providerCalls);
  assert.equal(h.calls.filter(c=>c.url.includes('jwks')).length,1);assert.equal(h.calls.some(c=>c.url.includes('localhost')),false);
 }
});
test('forged, tampered, stale and mismatched webhook messages cannot access stored jobs',async()=>{
 const h=await harness();
 const valid=await signed(),raw=await valid.text();
 for(const req of [new Request(valid.url,{method:'POST',body:raw}),new Request(valid.url,{method:'POST',headers:valid.headers,body:raw+' '}),await signed(undefined,{'x-fal-webhook-timestamp':String(Math.floor(Date.now()/1000)-301)})])assert.equal((await h.fn(req)).status,401);
 assert.equal((await h.fn(await signed({request_id:'different-request',status:'OK'}))).status,400);
 assert.equal(h.calls.some(c=>c.url.includes('/rest/v1/')),false);assert.equal(h.objects.size,0);
});
test('webhook arrival before the handle is saved requests a retry; storage and settlement failures recover without generation',async()=>{
 const h=await harness({hidden:true});assert.equal((await h.fn(await signed())).status,503);h.show();
 h.failUpload(true);assert.equal((await h.fn(await signed())).status,503);assert.equal(h.job.state,'pending');h.failUpload(false);
 h.failSave(true);assert.equal((await h.fn(await signed())).status,503);assert.equal(h.objects.size,1);assert.equal(h.job.state,'pending');h.failSave(false);
 h.failSettlement(true);assert.equal((await h.fn(await signed())).status,503);assert.equal(h.job.state,'ready');h.failSettlement(false);
 assert.equal((await h.fn(await signed())).status,200);assert.equal(h.objects.size,1);assert.equal(h.payments.at(-1).state,'complete');
 assert.equal(h.calls.some(c=>c.url.startsWith('https://queue.fal.run/')&&c.options.method==='POST'),false);
});
test('simultaneous callback and client completion converge on the same cached asset',async()=>{
 const {assetStore}=await import('../supabase/functions/recipe-image/assets.mjs'),h=await harness({step:1}),old=structuredClone(h.job);
 const results=await Promise.all([h.fn(await signed()),assetStore(h.config,h.fetcher).completeFal({id:rid,published:false},old)]);
 assert.equal(results[0].status,200);assert.equal(results[1].state,'ready');assert.equal(h.objects.size,1);assert.equal(h.job.asset_path,rid+'/1/'+lease+'.jpg');
});
test('terminal provider failures are acknowledged without resubmission, including settlement retries',async()=>{
 const h=await harness();h.terminal();h.failSettlement(true);assert.equal((await h.fn(await signed({request_id:id,status:'ERROR'}))).status,503);assert.equal(h.job.state,'failed');h.failSettlement(false);
 assert.equal((await h.fn(await signed({request_id:id,status:'ERROR'}))).status,200);assert.equal(h.payments.at(-1).state,'failed');assert.equal(h.objects.size,0);
});
test('a stale completion cannot replace an asset job claimed under a new lease',async()=>{
 const {assetStore}=await import('../supabase/functions/recipe-image/assets.mjs'),h=await harness(),old=structuredClone(h.job);h.replaceLease();
 await assert.rejects(()=>assetStore(h.config,h.fetcher).completeFal({id:rid,published:false},old),/IMAGE_UNAVAILABLE/);assert.equal(h.job.state,'pending');assert.equal(h.payments.length,0);
});
