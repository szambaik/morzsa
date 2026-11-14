const {test}=require('node:test'),assert=require('node:assert/strict');
const user='12345678-1234-1234-1234-123456789012',id='22345678-1234-1234-1234-123456789012',hid='32345678-1234-1234-1234-123456789012';
const output={answer:'Próbálj egy irodába vihető almás sütit.',transcript:'Másik süti?',clarification:'',operations:[],recipes:[]};
const config={url:'https://db.test',publishableKey:'public',serviceKey:'private-db-key',openaiKey:'private-openai-key',origins:['https://app.test']};
const request=(extra={})=>new Request('https://fn.test',{method:'POST',headers:{authorization:'Bearer user',origin:'https://app.test'},body:JSON.stringify({task:'chat',requestId:id,householdId:null,text:'Másik süti?',assistant:true,companion:true,history:[],...extra})});
function fixture({enabled=true,reserve='reserved',streamData=output}={}){
 const calls=[];return {calls,fetcher:async(url,options={})=>{calls.push({url,options});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:user});
  if(url.endsWith('/rpc/morzsa_plus_access'))return Response.json({enabled,scope:'user:'+user,remainingCents:500});
  if(url.endsWith('/rpc/reserve_morzsa_plus'))return Response.json({status:reserve});
  if(url.includes('/morzsa_plus_requests?'))return Response.json(options.method==='GET'?[{scope:'user:'+user,call_id:'rtc_12345678'}]:{});
  if(url.endsWith('/responses')){const raw=JSON.stringify(streamData),events=[{type:'response.output_text.delta',delta:raw.slice(0,25)},{type:'response.output_text.delta',delta:raw.slice(25)},{type:'response.completed',response:{status:'completed',usage:{input_tokens:3000,output_tokens:800}}}];return new Response(events.map(e=>'data: '+JSON.stringify(e)+String.fromCharCode(10,10)).join(''),{headers:{'Content-Type':'text/event-stream'}})}
  if(url.endsWith('/realtime/calls'))return new Response('v=0 ANSWER',{headers:{Location:'/v1/realtime/calls/rtc_12345678'}});
  if(url.endsWith('/hangup'))return new Response(null,{status:200});
  throw Error('Unexpected route '+url);
 }};
}
test('Plus is default without resetting existing saves; Free remains an explicit preference',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),items=new Map([['morzsa-v1','old-save']]);const context={window:{dispatchEvent(){},household:{userId:()=>user}},localStorage:{getItem:k=>items.get(k),setItem:(k,v)=>items.set(k,v)},CustomEvent:class{}};
 vm.runInNewContext(fs.readFileSync('ai-mode.js','utf8'),context);const mode=context.window.AIMode;assert.equal(mode.get(),'plus');assert.equal(mode.set('free'),true);assert.equal(mode.get(),'free');assert.equal(items.get('morzsa-v1'),'old-save');assert.equal(mode.set('unexpected'),false);
});
test('Plus denies ungranted accounts and exhausted/duplicate requests before any paid provider call',async()=>{
 const {createHandler}=await import('../supabase/functions/plus-assistant/handler.mjs');
 for(const options of [{enabled:false},{reserve:'limit'},{reserve:'duplicate'}]){const f=fixture(options),r=await createHandler(config,f.fetcher)(request());assert.equal(r.status,options.enabled===false?403:429);assert.equal(f.calls.some(c=>c.url.includes('openai.com')),false)}
 const f=fixture();const fn=createHandler(config,f.fetcher);assert.equal((await fn(new Request('https://fn.test',{method:'POST'}))).status,401);assert.equal((await fn(request({requestId:'invalid'}))).status,400);assert.equal(f.calls.some(c=>c.url.includes('openai.com')),false);
});
test('OpenAI streams answer previews, validates complete output and settles only token metadata',async()=>{
 const {createHandler}=await import('../supabase/functions/plus-assistant/handler.mjs'),f=fixture();const response=await createHandler(config,f.fetcher)(request({stream:true}));const events=(await response.text()).trim().split(String.fromCharCode(10)).map(JSON.parse);
 assert.equal(response.status,200);assert.ok(events.some(e=>e.type==='answer'&&e.text));assert.deepEqual(events.at(-1),{type:'done',output});assert.ok(!JSON.stringify(events).includes('private-'));
 const provider=JSON.parse(f.calls.find(c=>c.url.endsWith('/responses')).options.body);assert.equal(provider.store,false);assert.equal(provider.model,'gpt-6.1-terra');assert.equal(provider.text.format.strict,true);assert.equal(provider.text.format.schema.additionalProperties,false);
 const settlement=JSON.parse(f.calls.find(c=>c.options.method==='PATCH').options.body);assert.equal(settlement.charged_cents,1);assert.deepEqual(settlement.usage,{input_tokens:3000,output_tokens:800});assert.ok(!JSON.stringify(settlement).includes('almás'));
});
test('invalid paid output cannot become a proposal; no fallback reissues a billable request',async()=>{
 const {createHandler}=await import('../supabase/functions/plus-assistant/handler.mjs'),f=fixture({streamData:{...output,operations:[{action:'clear_all',name:'Tej',quantity:null,unit:null}]}});
 const r=await createHandler(config,f.fetcher)(request());assert.equal(r.status,503);assert.equal(f.calls.filter(c=>c.url.endsWith('/responses')).length,1);assert.equal(f.calls.some(c=>c.url.includes('groq')||c.url.includes('google')),false);
});
test('Realtime connection keeps permanent credentials server-side and end is scoped to the authenticated caller',async()=>{
 const {createHandler}=await import('../supabase/functions/plus-assistant/handler.mjs'),f=fixture();let deferred=0,watched=0;
 const fn=createHandler({...config,watchCall:async(callId,session)=>{watched++;assert.equal(callId,'rtc_12345678');assert.equal(session.audio.input.turn_detection.interrupt_response,true)},defer:()=>deferred++},f.fetcher);
 const r=await fn(request({task:'connect',sdp:'v=0 OFFER'})),data=await r.json();assert.equal(r.status,200);assert.equal(data.seconds,110);assert.equal(watched,1);assert.equal(deferred,1);assert.ok(!JSON.stringify(data).includes('private-'));assert.equal(data.callId,undefined);
 assert.equal((await fn(request({task:'end'}))).status,200);assert.equal(f.calls.filter(c=>c.url.endsWith('/hangup')).length,1);
});
test('paid images use an independent recipe/step-aware image model with a fixed modest preset',async()=>{
 const {openaiImage}=await import('../supabase/functions/plus-assistant/openai.mjs');let body;
 const recipe={title:'Rántotta',summary:'Puha tojás',minutes:10,ingredients:[{name:'Tojás',amount:'2 db'}],steps:['Lassan keverd.']};
 const img=await openaiImage({recipe,step:0},config,async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/images/generations');body=JSON.parse(options.body);return Response.json({data:[{b64_json:Buffer.from([255,216,255,0]).toString('base64')}]})});
 assert.equal(body.model,'gpt-image-2.6-flare');assert.equal(body.n,1);assert.equal(body.quality,'medium');assert.match(body.prompt,/only preparation step 1/);assert.match(body.prompt,/Rántotta/);assert.equal(img.type,'image/jpeg');
});
test('Plus grants, membership, shared budgets and request IDs are enforced atomically and privately',async()=>{
 const {PGlite}=await import('@electric-sql/pglite'),fs=require('node:fs'),db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table public.household_members(household_id uuid,user_id uuid);');const sql=fs.readFileSync('supabase/migrations/20261114_plus_assistant.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.morzsa_plus_entitlements'));await assert.rejects(db.query('select public.reserve_morzsa_plus($1,null,$2,$3,12)',[user,id,'chat']));await db.exec('reset role');
 const access=async(u,h)=>(await db.query('select public.morzsa_plus_access($1,$2) as data',[u,h])).rows[0].data;
 assert.equal((await access(user,null)).enabled,false);await db.query('insert into public.morzsa_plus_entitlements(scope,monthly_cents) values($1,20)',['home:'+hid]);assert.equal((await access(user,hid)).enabled,false);
 await db.query('insert into public.household_members values($1,$2)',[hid,user]);assert.equal((await access(user,hid)).enabled,true);
 const reserve=async(r)=>(await db.query('select public.reserve_morzsa_plus($1,$2,$3,$4,12) as data',[user,hid,r,'chat'])).rows[0].data;
 assert.equal((await reserve(id)).status,'reserved');assert.equal((await reserve(id)).status,'duplicate');assert.equal((await reserve('42345678-1234-1234-1234-123456789012')).status,'limit');assert.equal((await access(user,hid)).remainingCents,8);
 await db.query('update public.morzsa_plus_entitlements set expires_at=now()-interval '+"'1 minute'"+' where scope=$1',['home:'+hid]);assert.equal((await access(user,hid)).enabled,false);await db.close();
});
