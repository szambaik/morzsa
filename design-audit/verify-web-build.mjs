import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),web=path.join(root,'web-dist'),out=path.join(root,'design-audit/runs','web-build-'+new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(out,{recursive:true});
const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':data.length});res.end(data)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome',args:['--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost']});const results=[];
try{
 for(let rep=0;rep<3;rep++){
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await ctx.routeWebSocket('**/*',ws=>ws.close());await p.addInitScript(()=>{localStorage.setItem('morzsa-introduction-v1','done');window.__buildLcp=0;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__buildLcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})});
  const cdp=await ctx.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['https://*','wss://*']});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
  const start=performance.now();await p.goto(origin,{waitUntil:'load'});await p.waitForFunction(()=>document.querySelector('.app')?.dataset.page&&window.MorzsaCompanion&&window.RecipeImages);await p.waitForTimeout(100);const usableMs=performance.now()-start;await p.waitForTimeout(700);
  const metric=await p.evaluate(()=>({lcp:window.__buildLcp,scripts:[...document.scripts].map(s=>s.src),styles:[...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.href)}));assert.equal(metric.scripts.length,1);assert.equal(metric.styles.length,1);
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  for(const dest of ['overview','pantry','shopping','recipes','chat']){await p.locator('nav [data-page="'+dest+'"]').click();await p.waitForFunction(d=>document.querySelector('.app').dataset.page===d,dest);assert.ok(await p.locator('#main').innerText());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)}
  assert.deepEqual(errors,[]);if(rep===0)await p.screenshot({path:path.join(out,'bundled-chat.png')});results.push({rep,usableMs,...metric,pageErrors:errors});await ctx.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({out,results},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r))}
