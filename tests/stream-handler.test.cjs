const {test}=require('node:test'),assert=require('node:assert/strict'),Client=require('../chat-stream');
test('stream endpoint keeps authentication/quota and validates proposals before the final event',async()=>{
 const {createHandler}=await import('../supabase/functions/voice-command/handler.mjs');let calls=[];
 const output={answer:'Hello',transcript:'Hi',clarification:'',operations:[],recipes:[]};
 const fn=createHandler({url:'https://db.test',publishableKey:'pub',serviceKey:'secret',geminiKey:'gemini'},async(url,options)=>{calls.push({url,options});if(url.endsWith('/user'))return Response.json({id:'12345678-1234-1234-1234-123456789012'});if(url.includes('/rpc/'))return Response.json(true);return new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}]})+'\n\n')});
 const response=await fn(new Request('https://fn',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({assistant:true,companion:true,stream:true,text:'Hi'})}));assert.match(response.headers.get('Content-Type'),/ndjson/);assert.deepEqual(await Client.read(response,()=>{}),output);assert.equal(calls.length,3);assert.match(calls[1].url,/claim_voice_command/);assert.match(calls[2].url,/streamGenerateContent\?alt=sse/);
 calls=[];assert.equal((await fn(new Request('https://fn',{method:'POST',body:'{}'}))).status,401);assert.equal(calls.length,0);
});
