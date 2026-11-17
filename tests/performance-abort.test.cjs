const {test}=require('node:test'),assert=require('node:assert/strict');
const config={url:'https://db.invalid',publishableKey:'test-public',serviceKey:'test-service',geminiKey:'test-gemini',model:'gemini-primary',fallbackModel:'gemini-fallback'};
const pause=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
for(const stage of ['auth','quota','provider'])test('request cancellation during '+stage+' prevents later provider attempts',async()=>{
 const {createHandler}=await import('../supabase/functions/voice-command/handler.mjs');const started=pause(),held=pause(),calls=[];let observedSignal;
 const fetcher=async(url,options)=>{const kind=url.includes('/auth/')?'auth':url.includes('/rpc/')?'quota':'provider';calls.push(kind);if(kind===stage){observedSignal=options.signal;started.resolve();await held.promise}
  if(kind==='auth')return Response.json({id:'00000000-0000-4000-8000-000000000001'});if(kind==='quota')return Response.json(true);options.signal.throwIfAborted();return Response.json({});
 };
 const controller=new AbortController(),request=new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({text:'Mit főzzek?',assistant:true,companion:true,destination:'stock',language:'hu',context:{stock:[],cart:[]},history:[]}),signal:controller.signal});
 const work=createHandler(config,fetcher)(request);await started.promise;controller.abort();assert.equal(observedSignal.aborted,true);held.resolve();await work;assert.deepEqual(calls,stage==='auth'?['auth']:stage==='quota'?['auth','quota']:['auth','quota','provider']);
});
test('aborting a Gemini stream cancels its reader and never emits a completed proposal',async()=>{
 const {streamedResponse}=await import('../supabase/functions/voice-command/stream.mjs');let cancelled=false;
 const upstream=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"{\\"answer\\":\\"Hello"}]}}]}\n\n'))},cancel(){cancelled=true}}));
 const controller=new AbortController(),response=streamedResponse(upstream,{},x=>x,controller.signal),reader=response.body.getReader();await reader.read();controller.abort();let text='';for(;;){const r=await reader.read();if(r.done)break;text+=new TextDecoder().decode(r.value)}assert.equal(cancelled,true);assert.equal(text.includes('"type":"done"'),false);
});
