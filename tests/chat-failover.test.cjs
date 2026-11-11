const {test}=require('node:test'),assert=require('node:assert/strict'),Client=require('../chat-stream');
const config={url:'https://db.test',publishableKey:'public',serviceKey:'service-secret',geminiKey:'gemini-secret',origins:['https://app.test']};
const output={answer:'Tojásból készíthetsz rántottát.',transcript:'Mit főzzek?',clarification:'',operations:[],recipes:[]};
const request=()=>new Request('https://fn.test',{method:'POST',headers:{origin:'https://app.test',authorization:'Bearer user-token'},body:JSON.stringify({assistant:true,companion:true,stream:true,text:'Mit főzzek?',context:{stock:['Tojás'],cart:[]}})});
const stream=()=>new Response('data: '+JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]})+'\n\n');
test('overloaded primary falls back once; same payload, one quota claim, validated streaming answer',async()=>{
 const {createHandler}=await import('../supabase/functions/voice-command/handler.mjs');let quota=0,calls=[];
 const fn=createHandler(config,async(url,options)=>{
  if(url.endsWith('/user'))return Response.json({id:'12345678-1234-1234-1234-123456789012'});
  if(url.includes('/rpc/')){quota++;return Response.json(true)}
  calls.push({url,options});return calls.length===1?new Response('{}',{status:503}):stream();
 });
 const parts=[],result=await Client.read(await fn(request()),s=>parts.push(s));assert.deepEqual(result,output);assert.equal(quota,1);assert.equal(calls.length,2);assert.match(calls[1].url,/gemini-3.5-flash-lite:streamGenerateContent/);assert.equal(calls[0].options.body,calls[1].options.body);assert.equal(calls[0].options.signal,calls[1].options.signal);assert.equal(parts.at(-1),output.answer);
});
test('healthy primary needs no fallback; malformed requests are not retried',async()=>{
 const {generate}=await import('../supabase/functions/voice-command/provider.mjs');let count=0;
 await generate({}, {}, config,async()=>{count++;return Response.json({ok:true})});assert.equal(count,1);
 count=0;await assert.rejects(()=>generate({}, {}, config,async()=>{count++;return new Response('{}',{status:400})}),/VOICE_PROVIDER_ERROR/);assert.equal(count,1);
});
test('provider rate limits and overload stay distinct from the app daily quota, retries bounded',async()=>{
 const {generate}=await import('../supabase/functions/voice-command/provider.mjs');
 for(const [status,error] of [[429,'VOICE_PROVIDER_LIMIT'],[503,'VOICE_PROVIDER_BUSY']]){let calls=0;await assert.rejects(()=>generate({}, {}, config,async()=>{calls++;return new Response('{}',{status})}),new RegExp(error));assert.equal(calls,2)}
 let calls=0;await assert.rejects(()=>generate({}, {}, {...config,fallbackModel:''},async()=>{calls++;return new Response('{}',{status:503})}),/VOICE_PROVIDER_BUSY/);assert.equal(calls,1);
});
test('a broken successful stream never triggers fallback or emits a savable final result',async()=>{
 const {generate}=await import('../supabase/functions/voice-command/provider.mjs'),{streamedResponse}=await import('../supabase/functions/voice-command/stream.mjs');let calls=0;
 const r=await generate({stream:true},{},config,async()=>{calls++;return new Response('data: {"candidates":[{"content":{"parts":[{"text":"{\\\"answer\\\":\\\"partial"}]}}]}\n\n')});
 await assert.rejects(()=>Client.read(streamedResponse(r,{},v=>v),()=>{}),/VOICE_INVALID_RESPONSE/);assert.equal(calls,1);
});
test('combined schema avoids provider decoder limits while server validation keeps all bounds',async()=>{
 const {bodyFor,validOutput}=await import('../supabase/functions/voice-command/handler.mjs');
 const body=bodyFor({assistant:true,companion:true,stream:true,text:'Mit főzzek?',language:'hu'});
 assert.ok(!JSON.stringify(body.generationConfig.responseSchema).includes('maxItems'));
 assert.ok(body.generationConfig.responseSchema.required.includes('operations'));
 assert.ok(body.generationConfig.responseSchema.required.includes('recipes'));
 assert.ok(!validOutput({...output,operations:Array(31).fill({action:'stock_add',name:'Tej',quantity:null,unit:null})}));
 assert.ok(!validOutput({...output,recipes:Array(4).fill({title:'Recept',summary:'Rövid',minutes:10,ingredients:[{name:'Tojás',amount:'1 db'}],steps:['Süsd meg.']})}));
});
