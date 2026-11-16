import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';
import {startFixture,actors,householdId} from './fixture.mjs';
const root=path.resolve(process.env.MORZSA_PERF_SOURCE||path.resolve(import.meta.dirname,'../..')),mode=process.argv[2]||'full';
const run=path.join(import.meta.dirname,'runs',new Date().toISOString().replaceAll(':','-')+'-'+mode);
for(const d of ['screenshots','traces'])fs.mkdirSync(path.join(run,d),{recursive:true});
const result={mode,run,startedAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch,labOnly:true},startup:[],checks:[],actions:[],memory:[],network:[],errors:[],blocked:[],screenshots:[],journeys:[]};
const save=()=>fs.writeFileSync(path.join(run,'results.json'),JSON.stringify(result,null,2));
const log=t=>console.log(new Date().toISOString()+' '+t);
const write=(name,data)=>fs.writeFileSync(path.join(run,name),typeof data==='string'?data:JSON.stringify(data,null,2));
const check=(id,passed,details={})=>{result.checks.push({id,status:passed?'passed':'failed',details});save();log(id+': '+(passed?'PASS':'FAIL'))};
const stock={stock:{Alma:2,Tej:1,Liszt:0,'Tojás':2,Rizs:2,Vaj:2},cart:[],custom:[],history:[],likes:[],skips:[],chats:{}};
const views=[{width:320,height:640},{width:375,height:812},{width:390,height:844},{width:768,height:1024},{width:1280,height:800},{width:1440,height:900}];
const profiles={fast:{latency:0,downloadThroughput:-1,uploadThroughput:-1},mobile:{latency:80,downloadThroughput:1250000,uploadThroughput:250000},slow4g:{latency:150,downloadThroughput:200000,uploadThroughput:93750},highLatency:{latency:400,downloadThroughput:1250000,uploadThroughput:250000}};
const sourceFiles=Object.keys(JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'snapshot.json'),'utf8')).files);const fingerprints=()=>Object.fromEntries(sourceFiles.map(f=>[f,fs.existsSync(path.join(root,f))?createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex'):null]));const sourceBefore=fingerprints();write('source-before.json',sourceBefore);result.sourceRoot=root;
const fixture=await startFixture({repoRoot:root});let browser;
try{browser=await chromium.launch({headless:true,channel:'chromium',args:['--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost']})}catch(e){result.environment.browserFallback=e.message.split('\n')[0];browser=await chromium.launch({headless:true,channel:'chrome',args:['--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost']})}
result.environment.browser=browser.version();let screenshotNumber=0;
async function context({actor=null,shared=false,viewport=views[2],trace=false,initial=stock}={}){
 const ctx=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce',hasTouch:viewport.width<768});
 if(trace)await ctx.tracing.start({screenshots:true,snapshots:true,sources:false});
 const sockets=[];
 await ctx.routeWebSocket('**/*',ws=>{
  if(new URL(ws.url()).host!==new URL(fixture.origin).host){result.blocked.push({type:'websocket',url:ws.url().split('?')[0]});ws.close();return}
  const entry={ws,topic:null};sockets.push(entry);ws.onMessage(data=>{const m=JSON.parse(String(data));if(m.event==='phx_join')entry.topic=m.topic;if(['phx_join','heartbeat'].includes(m.event))ws.send(JSON.stringify({topic:m.topic,event:'phx_reply',ref:m.ref,payload:{status:'ok',response:{postgres_changes:[]}}}))});ws.onClose(()=>{const i=sockets.indexOf(entry);if(i>=0)sockets.splice(i,1)});
 });
 const signal=()=>{for(const {ws,topic} of sockets)if(topic?.startsWith('realtime:morzsa:'))ws.send(JSON.stringify({topic,event:'postgres_changes',payload:{}}))};fixture.mutations.add(signal);
 await ctx.addInitScript(({actor,id,shared,hid,initial})=>{
  if(!localStorage.getItem('perf-fixture-seeded')){localStorage.setItem('perf-fixture-seeded','1');localStorage.setItem('morzsa-v2',JSON.stringify(initial));localStorage.setItem('morzsa-introduction-v1','done');localStorage.setItem('morzsa-ai-mode','free');if(actor){localStorage.setItem('morzsa-session',JSON.stringify({access_token:'audit-'+actor,expires_at:9999999999,user:{id,email:actor+'@audit.invalid'}}));localStorage.setItem('morzsa-last-household-'+id,JSON.stringify({id:shared?hid:null,name:'Audit kitchen'}))}}
  window.__perf={longTasks:[],events:[],lcp:[],cls:0,heartbeats:[],mutations:0,renders:[]};
  for(const type of ['longtask','event','largest-contentful-paint','layout-shift'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='longtask')__perf.longTasks.push({start:e.startTime,duration:e.duration});if(type==='event'&&e.interactionId)__perf.events.push({name:e.name,start:e.startTime,duration:e.duration,interactionId:e.interactionId});if(type==='largest-contentful-paint')__perf.lcp.push({start:e.startTime,size:e.size,element:e.element?.tagName});if(type==='layout-shift'&&!e.hadRecentInput)__perf.cls+=e.value}}).observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})})}catch{}
  let last=performance.now();setInterval(()=>{const now=performance.now();if(now-last>80)__perf.heartbeats.push({start:last,delay:now-last-50});last=now},50);
  addEventListener('unhandledrejection',e=>{(__perf.rejections??=[]).push(String(e.reason))});
 },{actor,id:actors[actor],shared,hid:householdId,initial});
 const p=await ctx.newPage(),cdp=await ctx.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['https://*','wss://*']});
 const net=new Map();cdp.on('Network.requestWillBeSent',e=>{const u=new URL(e.request.url);net.set(e.requestId,{path:u.pathname+u.search,origin:u.origin,method:e.request.method,start:e.timestamp,type:e.type,requestBytes:e.request.postData?Buffer.byteLength(e.request.postData):0})});
 cdp.on('Network.responseReceived',e=>{const n=net.get(e.requestId);if(n)Object.assign(n,{status:e.response.status,ttfb:(e.timestamp-n.start)*1000,fromDiskCache:!!e.response.fromDiskCache,protocol:e.response.protocol})});
 cdp.on('Network.loadingFinished',e=>{const n=net.get(e.requestId);if(n){n.duration=(e.timestamp-n.start)*1000;n.responseBytes=e.encodedDataLength;result.network.push(n);net.delete(e.requestId)}});
 cdp.on('Network.loadingFailed',e=>{const n=net.get(e.requestId);if(n){n.failure=e.errorText;n.blockedReason=e.blockedReason;result.network.push(n);net.delete(e.requestId)}});
 p.on('pageerror',e=>result.errors.push({type:'pageerror',message:e.message}));p.on('console',m=>{if(m.type()==='error'&&!/ERR_BLOCKED|ERR_NAME_NOT_RESOLVED/.test(m.text()))result.errors.push({type:'console',message:m.text()})});
 return {ctx,p,cdp,sockets,signal,close:async(name)=>{fixture.mutations.delete(signal);if(trace)await ctx.tracing.stop({path:path.join(run,'traces',name+'.zip')});await ctx.close()}};
}
async function loaded(p){await p.waitForFunction(()=>typeof dashboardGo==='function'&&!!document.querySelector('#main')?.children.length);await p.waitForTimeout(100)}
async function settled(p){await p.waitForFunction(()=>!window.household?.busy&&(!household?.userId()||MorzsaPersistence.status()==='synced'),{},{timeout:12000});await p.waitForTimeout(200)}
async function capture(p,label){const stem=String(++screenshotNumber).padStart(2,'0')+'-'+label,file='screenshots/'+stem+'.png';await p.screenshot({path:path.join(run,file),animations:'disabled'});write('screenshots/'+stem+'.txt',await p.locator('body').ariaSnapshot());result.screenshots.push({label,file});save()}
async function metrics(p){return p.evaluate(()=>({navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),paints:performance.getEntriesByType('paint').map(x=>x.toJSON()),lcp:__perf.lcp.at(-1)?.start||null,cls:__perf.cls,longTasks:__perf.longTasks,tbt:__perf.longTasks.reduce((n,e)=>n+Math.max(0,e.duration-50),0),maxInteractionDuration:Math.max(0,...__perf.events.map(e=>e.duration)),events:__perf.events,mainNodes:document.querySelectorAll('#main *').length,domNodes:document.querySelectorAll('*').length,resources:performance.getEntriesByType('resource').map(e=>({name:new URL(e.name).pathname,duration:e.duration,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,initiatorType:e.initiatorType})),heartbeat:__perf.heartbeats,unhandled:__perf.rejections||[]}))}
async function nav(p,dest){const b=p.locator('nav button[data-page="'+dest+'"]'),t=performance.now();await b.click();await p.waitForFunction(d=>document.querySelector('.app').dataset.page===d,dest);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const duration=performance.now()-t;result.actions.push({name:'navigation',destination:dest,duration});return duration}
async function attempt(id,fn){try{await fn();check(id,true)}catch(e){check(id,false,{message:e.message,stack:e.stack?.split('\n').slice(0,4)});log('Failure retained; continuing independent tests')}}
async function startup(){
 const cases=mode==='smoke'?[{viewport:views[2],profile:'fast',cpu:1,repeats:1}]:[...views.map(viewport=>({viewport,profile:'fast',cpu:1,repeats:3})),...['mobile','slow4g','highLatency'].map(profile=>({viewport:views[2],profile,cpu:1,repeats:3})),{viewport:views[2],profile:'fast',cpu:4,repeats:3}];
 for(const test of cases)for(let rep=0;rep<test.repeats;rep++){
  const x=await context({viewport:test.viewport});await x.cdp.send('Network.emulateNetworkConditions',{offline:false,...profiles[test.profile]});await x.cdp.send('Emulation.setCPUThrottlingRate',{rate:test.cpu});
  for(const cache of ['cold','warm']){if(cache==='cold')await x.cdp.send('Network.clearBrowserCache');const start=performance.now();if(cache==='cold')await x.p.goto(fixture.origin,{waitUntil:'load'});else await x.p.reload({waitUntil:'load'});await loaded(x.p);const usable=performance.now()-start;await x.p.waitForTimeout(700);const m=await metrics(x.p);result.startup.push({viewport:test.viewport,profile:test.profile,cpu:test.cpu,rep,cache,usable,...m});save();if(rep===0&&cache==='cold'&&test.profile==='fast'&&test.cpu===1)await capture(x.p,'startup-'+test.viewport.width);log('startup '+test.viewport.width+' '+test.profile+' CPU'+test.cpu+' '+cache+' '+Math.round(usable)+'ms')}await x.close();
 }
}
async function initialJourneys(){
 const x=await context({actor:'c',trace:true}),p=x.p;await p.goto(fixture.origin);await loaded(p);await settled(p);
 await attempt('navigation-five-destinations',async()=>{for(const dest of ['overview','pantry','shopping','recipes','chat']){await nav(p,dest);await capture(p,'journey-'+dest)}});
 write('observed-dom.txt',await p.locator('body').ariaSnapshot());write('observed-globals.json',await p.evaluate(()=>({page,stock:state.stock,cart:state.cart,persistence:MorzsaPersistence.status(),cloud:household.active,recipeLibrary:Object.keys(RecipeLibrary),companion:Object.keys(MorzsaCompanion)})));
 await x.close('initial-journeys');
}
try{if(mode==='faults'){const {runFaults}=await import('./faults.mjs');await runFaults({context,fixture,settled,capture,attempt,check,result,write,log})}else if(['supplement','soak'].includes(mode)){const {runSupplement}=await import('./supplement.mjs');await runSupplement({context,fixture,loaded,settled,nav,capture,metrics,attempt,check,result,write,log,save,run,mode,root})}else{if(mode!=='journeys')await startup();await initialJourneys();if(mode!=='smoke'){const {runJourneys}=await import('./journeys.mjs');await runJourneys({context,fixture,loaded,settled,nav,capture,metrics,attempt,check,result,write,log,save,run,stock})}}}catch(e){result.fatal={message:e.message,stack:e.stack};log('FATAL '+e.message)}finally{
 result.fixtureCalls=fixture.calls;result.sqlTimings=fixture.queryTimings;result.unsupportedFixtureRequests=fixture.unexpected;result.finishedAt=new Date().toISOString();const sourceAfter=fingerprints();write('source-after.json',sourceAfter);result.sourceChangedDuringRun=sourceFiles.filter(f=>sourceBefore[f]!==sourceAfter[f]);save();await browser.close();await fixture.close();fs.writeFileSync(path.join(import.meta.dirname,'latest-run.txt'),run+'\n');log('AUDIT_RUN='+run);
}
