import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {startFixture,actors} from './performance/fixture.mjs';
import {createHandler} from '../supabase/functions/plus-assistant/handler.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(import.meta.dirname,'runs','plus-latency-'+new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(out,{recursive:true});
const fixture=await startFixture({repoRoot:root}),origin=fixture.origin;
const browser=await chromium.launch({headless:true,channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome',args:['--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost']});
const result={labOnly:true,rpcDelayMs:200,providerDependenciesDelayMs:120,sourceRevision:process.env.MORZSA_LATENCY_REVISION||'working-tree',errors:[]};
try{
 result.sourceHashes=Object.fromEntries(['companion-ui.js','persistence.js','supabase/functions/plus-assistant/handler.mjs','supabase/functions/plus-assistant/openai.mjs'].map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference',serviceWorkers:'block'});ctx.setDefaultTimeout(15000);await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await ctx.routeWebSocket('**/*',ws=>ws.close());
 await ctx.addInitScript(({id})=>{localStorage.setItem('morzsa-introduction-v1','done');localStorage.setItem('morzsa-ai-mode','plus');localStorage.setItem('morzsa-session',JSON.stringify({access_token:'audit-c',expires_at:9999999999,user:{id,email:'c@audit.invalid'}}));},{id:actors.c});
 await ctx.tracing.start({screenshots:true,snapshots:true});const p=await ctx.newPage();p.on('pageerror',e=>result.errors.push(e.message));
 await p.goto(origin);await p.waitForFunction(()=>window.MorzsaPersistence?.status()==='synced',{},{timeout:15000});await p.evaluate(()=>MorzsaCompanion.newChat());await p.waitForTimeout(700);await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
 const prefix='A tojást lassú tűzön, kevergetve készítsd el. '.repeat(32),answer=prefix+'Tálalhatod.';
 fixture.ai.push({stream:[prefix],interval:3500,output:{answer,transcript:'Hogyan készítsek rántottát?',operations:[],recipes:[],clarification:''}});fixture.rules.push({match:'/rpc/',delay:200,remaining:-1});
 await p.locator('#companion-input').fill('Hogyan készítsek rántottát?');
 const callStart=fixture.calls.length;
 await p.evaluate(()=>{window.__latency={};const original=household.voiceCommandStream;household.voiceCommandStream=(payload,onAnswer,signal)=>{__latency.dispatched=performance.now();return original(payload,text=>{__latency.firstChunk??=performance.now();onAnswer(text)},signal).then(value=>{__latency.completed=performance.now();return value})};__latency.started=performance.now();document.querySelector('#companion-form').requestSubmit()});
 await p.waitForFunction(()=>window.__latency.firstChunk,{},{timeout:15000});await p.waitForTimeout(450);
 result.browser=await p.evaluate(()=>({...__latency,visibleAfter450ms:document.querySelector('[data-stream-answer]')?.textContent.length||0}));result.browser.expectedPrefixChars=prefix.length;
 await p.screenshot({path:path.join(out,'stream-after-450ms.png')});
 await p.waitForFunction(()=>window.__latency.completed,{},{timeout:12000});await p.waitForTimeout(80);
 result.browser.afterComplete=await p.evaluate(()=>({completed:__latency.completed,stillAnimating:!!document.querySelector('[data-answer-reveal]'),text:document.querySelector('.companion-message.model:last-of-type')?.innerText.length||0}));
 result.browser.sendToDispatchMs=result.browser.dispatched-result.browser.started;result.browser.dispatchToChunkMs=result.browser.firstChunk-result.browser.dispatched;
 result.browser.rpcCalls=fixture.calls.slice(callStart).filter(c=>c.path.includes('/rpc/')).map(({path,duration,status})=>({path,duration,status}));
 await ctx.tracing.stop({path:path.join(out,'trace.zip')});await ctx.close();
 const start=performance.now(),calls=[];let firstPreview;
 const delay=ms=>new Promise(r=>setTimeout(r,ms)),output={answer:'Lassú tűzön, folyamatosan keverd.',operations:[],recipes:[],clarification:''};
 const handler=createHandler({url:'https://synthetic.test',publishableKey:'synthetic',serviceKey:'synthetic',openaiKey:'synthetic'},async(url,options={})=>{calls.push({path:new URL(url).pathname,atMs:performance.now()-start});
  if(url.endsWith('/user')){await delay(120);return Response.json({id:actors.c})}
  if(url.endsWith('/morzsa_plus_access')){await delay(120);return Response.json({enabled:true,scope:'user:'+actors.c})}
  if(url.endsWith('/reserve_morzsa_plus')){await delay(120);return Response.json({status:'reserved'})}
  if(options.method==='PATCH'){await delay(120);return Response.json({})}
  if(url.endsWith('/responses')){await delay(60);const body=JSON.parse(options.body);const full={...output,...(body.text.format.schema.properties.transcript?{transcript:'Hogyan készítsek rántottát?'}:{})};return new Response([{type:'response.output_text.delta',delta:JSON.stringify(full)},{type:'response.completed',response:{status:'completed',usage:{input_tokens:2500,output_tokens:100}}}].map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''))}
  throw Error('Unexpected synthetic route');
 });
 const response=await handler(new Request('https://fn.test',{method:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify({task:'chat',requestId:crypto.randomUUID(),text:'Hogyan készítsek rántottát?',assistant:true,companion:true,stream:true})}));
 const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;if(!firstPreview&&new TextDecoder().decode(value).includes('"type":"answer"'))firstPreview=performance.now()-start}
 result.server={calls,firstPreviewMs:firstPreview,totalMs:performance.now()-start};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({out,...result},null,2));
 if(process.argv.includes('--check')){assert.deepEqual(result.errors,[]);assert.equal(result.browser.visibleAfter450ms,prefix.length);assert.equal(result.browser.afterComplete.stillAnimating,false);assert.equal(calls.filter(c=>c.path.endsWith('/morzsa_plus_access')).length,0);assert.equal(result.browser.rpcCalls.filter(c=>c.path.endsWith('/begin_conversation_turn_page')).length,1);assert.equal(result.browser.rpcCalls.filter(c=>c.path.endsWith('/conversation_page')).length,0)}
}finally{await browser.close();await fixture.close()}
