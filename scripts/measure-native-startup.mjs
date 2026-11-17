// Local, cold-context browser comparison. This is not an iPhone/device benchmark.
// Build both targets first. Uses design-audit's Playwright or PLAYWRIGHT_MODULE.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const baseline=path.resolve(root,process.env.NATIVE_BASELINE_DIST||'web-dist');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../design-audit/node_modules/playwright');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),folder=url.pathname.startsWith('/web-dist/')?baseline:path.join(root,'dist');
  const file=path.resolve(folder,decodeURIComponent(url.pathname).replace(/^\/(?:web-dist|dist)\//,''));
  if(!file.startsWith(folder+path.sep)){res.writeHead(404);return res.end()}
  let body=await fs.readFile(file);
  if(url.pathname==='/web-dist/index.html')body=body.toString().replace('<script src="catalog.js','<script src="/dist/native-bridge.js"></script><script src="catalog.js');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const samples={separate:[],bundled:[]};
try{
 for(let i=0;i<12;i++)for(const kind of i%2?['bundled','separate']:['separate','bundled']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname.startsWith('/rest/')||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/functions/'))return route.fulfill({contentType:'application/json',body:'[]'});return route.continue()});
  await context.addInitScript(origin=>{
   Object.defineProperty(window,'MORZSA_CLOUD',{get:()=>({url:origin,publishableKey:'qa'}),set(){}});
   localStorage.setItem('morzsa-introduction-v1','seen');localStorage.setItem('morzsa-v2',JSON.stringify({stock:{Tej:1,Tojás:2},cart:[],likes:[],custom:[]}));
  },origin);
  const page=await context.newPage();let requests=0;page.on('request',r=>{if(['script','stylesheet'].includes(r.resourceType()))requests++});
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  if(process.env.NATIVE_PROFILE&&i===0){await cdp.send('Profiler.enable');await cdp.send('Profiler.start')}
  await page.goto(origin+(kind==='separate'?'/web-dist/index.html':'/dist/index.html'));
  await page.waitForFunction(()=>!!window.MorzsaProactive&&!!document.getElementById('companion-input'));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  samples[kind].push(await page.evaluate(requests=>{const nav=performance.getEntriesByType('navigation')[0];return {domContentLoadedMs:nav.domContentLoadedEventEnd,loadMs:nav.loadEventEnd,scriptAndStyleRequests:requests}},requests));
  const metrics=(await cdp.send('Performance.getMetrics')).metrics;samples[kind].at(-1).metrics=Object.fromEntries(metrics.filter(m=>['ScriptDuration','LayoutDuration','RecalcStyleDuration','TaskDuration','LayoutCount','RecalcStyleCount'].includes(m.name)).map(m=>[m.name,m.value]));
  if(process.env.NATIVE_PROFILE&&i===0){const {profile}=await cdp.send('Profiler.stop');await fs.writeFile(path.join(root,'tmp',kind+'-startup-profile.json'),JSON.stringify(profile));console.log(kind,profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,12).map(n=>({name:n.callFrame.functionName,url:n.callFrame.url.split('/').at(-1),line:n.callFrame.lineNumber,hits:n.hitCount})))}
  await context.close();
 }
 const median=values=>{const s=[...values].sort((a,b)=>a-b);return Math.round((s[5]+s[6])/2*10)/10};
 const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
 const report={environment:'Desktop Chromium, localhost, 390×844, 12 fresh contexts per variant, alternating order; external traffic blocked; identical synthetic pantry; no CPU throttling',browser:browser.version(),baseline,inputs:{baselineIndex:await hash(path.join(baseline,'index.html')),baselineProactive:await hash(path.join(baseline,'proactive-ui.js')),nativeApp:await hash(path.join(root,'dist/morzsa-app.js')),nativeSuggestions:await hash(path.join(root,'dist/morzsa-suggestions.js'))},summary:Object.fromEntries(Object.entries(samples).map(([kind,rows])=>[kind,{medianDOMContentLoadedMs:median(rows.map(r=>r.domContentLoadedMs)),medianLoadMs:median(rows.map(r=>r.loadMs)),scriptAndStyleRequests:rows[0].scriptAndStyleRequests}])),samples};
 const output=path.resolve(root,process.env.NATIVE_BENCHMARK_OUTPUT||'tmp/ios-startup-benchmark.json');await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
