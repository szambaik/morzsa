const {test}=require('node:test'),assert=require('node:assert/strict'),Client=require('../chat-stream');
const output={answer:'Szia!',transcript:'Szia',operations:[],clarification:'',recipes:[]};
const config={url:'https://db',publishableKey:'public',serviceKey:'secret',groqKey:'groq-secret',geminiKey:'google-secret'};
const groq=(v=output,finish='stop')=>new Response('data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(v)},finish_reason:finish}]})+'\n\ndata: [DONE]\n\n');
const input={assistant:true,companion:true,stream:true,text:'Szia',language:'hu'};
test('Groq handles text with legacy schema, one quota and one validated result',async()=>{
 const {createHandler}=await import('../supabase/functions/voice-command/handler.mjs');let quota=0,calls=[];
 const fn=createHandler(config,async(url,o)=>{if(url.endsWith('/user'))return Response.json({id:'12345678-1234-1234-1234-123456789012'});if(url.includes('/rpc/')){quota++;return Response.json(true)}calls.push({url,o});return groq()});
 const r=await fn(new Request('https://fn',{method:'POST',headers:{authorization:'Bearer user'},body:JSON.stringify(input)}));
 assert.deepEqual(await Client.read(r,()=>{}),output);assert.equal(quota,1);assert.equal(calls.length,1);assert.match(calls[0].url,/api.groq.com/);assert.equal(JSON.parse(calls[0].o.body).stream,true);
});
test('Groq invalid or failed stream retries only once on Gemini and clears the preview',async()=>{
 const {textOutput}=await import('../supabase/functions/voice-command/groq.mjs'),{bodyFor,validOutput}=await import('../supabase/functions/voice-command/handler.mjs');
 for(const response of [groq({...output,operations:[{action:'delete_household'}]}),new Response('{}',{status:429}),groq(output,'length')]){
  let calls=0,parts=[];const result=await textOutput(input,bodyFor(input),config,async()=>++calls===1?response:new Response('data: '+JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]})+'\n\n'),s=>parts.push(s),v=>{if(!validOutput(v))throw Error('VOICE_INVALID_RESPONSE');return v});
  assert.deepEqual(result,output);assert.equal(calls,2);assert.ok(parts.includes(''));
 }
});
test('explicit cancellation does not start fallback',async()=>{
 const {textOutput}=await import('../supabase/functions/voice-command/groq.mjs'),{bodyFor}=await import('../supabase/functions/voice-command/handler.mjs');let calls=0;const c=new AbortController();
 await assert.rejects(()=>textOutput(input,bodyFor(input),config,async()=>{calls++;c.abort();throw new DOMException('Aborted','AbortError')},()=>{},v=>v,c.signal),/ABORTED/);assert.equal(calls,1);
});
