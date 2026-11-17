// Run against the isolated persistence fixture on 8942. No external API calls.
import {chromium,webkit} from '../design-audit/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const engine=process.env.MORZSA_IMAGE_BROWSER||'webkit',out=process.env.MORZSA_IMAGE_QA_OUT||'/tmp/morzsa-image-recovery';
fs.mkdirSync(out,{recursive:true});
const browser=await ({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'}:{})}),ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage();
const rid='10000000-0000-4000-8000-000000000001',inputs=[],errors=[];let mode='generate';
p.on('pageerror',e=>errors.push(e.message));
await ctx.route('**/*',async route=>{
 const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
 if(u.pathname==='/functions/v1/recipe-image'){
  const body=route.request().postDataJSON();
  if(body.recipeId===rid&&body.step===-1){
   inputs.push(body);
   if(mode==='error')return route.fulfill({status:503,json:{error:'IMAGE_TIMEOUT'}});
   if(mode==='generate'&&!body.create)return route.fulfill({status:200,json:{status:'missing'}});
   if(mode==='generate'&&body.create)mode='pending';
   if(mode==='pending')return route.fulfill({status:202,json:{status:'pending'}});
  }
  return route.fulfill({status:200,json:{status:'ready',url:'http://127.0.0.1:8942/storage/v1/object/public/recipe-catalog/'+body.recipeId+'/cover.jpg',expiresAt:Date.now()+86400000}});
 }return route.continue();
});
const host=p.locator('[data-feed-image="'+rid+'"]');
const show=async()=>{await p.locator('nav [data-page=recipes]').click();await p.getByRole('tab',{name:'Böngészés',exact:true}).click();await host.waitFor({state:'attached'});await host.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}))};
try{
 await p.goto('http://127.0.0.1:8942/?actor=c');await p.waitForFunction(()=>MorzsaPersistence.status()==='synced'&&!household.busy);
 await show();await p.waitForFunction(id=>document.querySelector('[data-feed-image="'+id+'"]')?.dataset.imageStatus==='pending',rid);
 assert.equal(await host.locator('.image-placeholder').isVisible(),true);
 assert.equal(await host.locator('[role=status]').getAttribute('aria-label'),'Receptkép betöltése folyamatban');
 assert.equal(await host.innerText(),'');
 assert.equal(await host.locator('.image-placeholder-progress i').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await p.screenshot({path:out+'/'+engine+'-placeholder-390.png'});
 await p.locator('nav [data-page=chat]').click();await p.waitForTimeout(1100);mode='ready';
 await show();await host.locator('img').waitFor();await p.waitForFunction(id=>document.querySelector('[data-feed-image="'+id+'"] img')?.naturalWidth>0,rid);
 assert.equal(inputs.filter(i=>i.create).length,1);
 mode='error';inputs.length=0;await p.reload();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced'&&!household.busy);await show();
 const retry=host.getByRole('button',{name:'Kép újratöltése'});await retry.waitFor();
 assert.equal(await retry.evaluate(el=>getComputedStyle(el).pointerEvents),'auto');assert.ok((await retry.boundingBox()).height>=44);
 await p.screenshot({path:out+'/'+engine+'-retry-390.png'});
 mode='ready';await p.evaluate(()=>window.dispatchEvent(new Event('morzsa-resume')));await host.locator('img').waitFor();
 assert.equal(inputs.every(i=>i.create===false),true);
 for(const width of [320,390,430]){await p.setViewportSize({width,height:844});await host.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
 await p.screenshot({path:out+'/'+engine+'-recovered-430.png'});assert.deepEqual(errors,[]);
 const result={engine,pendingReturn:true,nativeResume:true,cacheOnlyRecovery:true,retryTouchTarget:true,widths:[320,390,430],errors};fs.writeFileSync(out+'/'+engine+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await ctx.close();await browser.close()}
