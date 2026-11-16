import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {createHandler} from '../../supabase/functions/voice-command/handler.mjs';
const require=createRequire(import.meta.url),Client=require('../../chat-stream.js');
const dir=path.join(import.meta.dirname,'provider-runs',new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(dir,{recursive:true});
const result={environment:'Actual Edge Function modules with injected fetch; all endpoints synthetic. Timings describe scripted delay and app overhead, not live providers.',cases:[]};
const output={transcript:'Mit főzzek?',answer:'Készíts rántottát a tojásból.',operations:[],recipes:[],clarification:''};
const config={url:'https://audit.invalid',publishableKey:'synthetic-public',serviceKey:'synthetic-service',geminiKey:'synthetic-gemini',origins:['https://app.audit.invalid']};
const delay=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted)return reject(new DOMException('Aborted','AbortError'));const t=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'))},{once:true})});
for(const scenario of ['healthy','overload-fallback','header-stall-default','cancelled-client-preflight','malformed-stream']){
 const t=performance.now(),calls=[],parts=[];let providerCount=0;const controller=new AbortController();
 const fn=createHandler(config,async(url,options={})=>{
  calls.push({url:url.replace(/https:\/\/[^/]+/,'<synthetic>'),atMs:performance.now()-t,bodyBytes:options.body?Buffer.byteLength(options.body):0});
  if(url.endsWith('/user')){await delay(120,options.signal);return Response.json({id:'00000000-0000-4000-8000-000000000001'})}
  if(url.includes('/rpc/')){await delay(120,options.signal);return Response.json(true)}providerCount++;
  if(scenario==='header-stall-default'&&providerCount===1){await delay(20000,options.signal)}
  if(scenario==='overload-fallback'&&providerCount===1)return new Response('{}',{status:503});
  await delay(150,options.signal);
  const value={candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]};
  if(url.includes('streamGenerateContent'))return new Response('data: '+JSON.stringify(scenario==='malformed-stream'?{candidates:[{content:{parts:[{text:'{"answer":"partial'}]}}]}:value)+'\n\n');
  return Response.json(value);
 });
 if(scenario==='cancelled-client-preflight')setTimeout(()=>controller.abort(),30);
 const row={scenario,calls,parts,providerCount:0};try{const response=await fn(new Request('https://fn.audit.invalid',{method:'POST',headers:{origin:'https://app.audit.invalid',authorization:'Bearer synthetic'},signal:controller.signal,body:JSON.stringify({assistant:true,companion:true,stream:true,text:'Mit főzzek?',context:{stock:['Tojás'],cart:[]}})}));row.status=response.status;row.headerMs=performance.now()-t;row.output=await Client.read(response,text=>parts.push({atMs:performance.now()-t,text}));row.success=true}catch(e){row.error=e.message;row.success=false}row.totalMs=performance.now()-t;row.providerCount=providerCount;row.clientAborted=controller.signal.aborted;result.cases.push(row);console.log(scenario,Math.round(row.totalMs),row.error||'ok')
}
fs.writeFileSync(path.join(dir,'providers.json'),JSON.stringify(result,null,2));console.log('PROVIDER_RUN='+dir);
