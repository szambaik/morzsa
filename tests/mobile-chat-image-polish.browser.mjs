// Isolated UI verification: synthetic pantry/history and local image responses only.
import {chromium,webkit} from '../design-audit/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const engine=process.env.MORZSA_IMAGE_BROWSER||'chromium',base=process.env.MORZSA_QA_BASE||'http://127.0.0.1:8942',out=process.env.MORZSA_IMAGE_QA_OUT||'/tmp/morzsa-polish-ui';
fs.mkdirSync(out,{recursive:true});
const browser=await ({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'}:{})});
const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await ctx.newPage(),errors=[],inputs=[];
let failOnce=true;
p.on('pageerror',e=>errors.push(e.message));
await ctx.route('**/*',async route=>{
 const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
 if(u.pathname==='/functions/v1/recipe-image'){
  const body=route.request().postDataJSON();inputs.push(body);
  if(failOnce){failOnce=false;return route.fulfill({status:503,json:{error:'IMAGE_TIMEOUT'}})}
  return route.fulfill({status:200,json:{status:'ready',url:base+'/storage/v1/object/public/recipe-catalog/'+body.recipeId+'/cover.jpg',expiresAt:Date.now()+86400000}});
 }return route.continue();
});
try{
 await p.goto(base+'/?actor=c');await p.waitForFunction(()=>MorzsaPersistence.status()==='synced'&&!household.busy);
 await p.evaluate(()=>{for(const item of catalog)state.stock[item.name]=2});
 await p.locator('nav [data-page=overview]').click();
 const image=p.locator('[data-proactive-image]').first();await image.waitFor();await image.scrollIntoViewIfNeeded();
 await image.locator('img').waitFor();await p.waitForFunction(()=>document.querySelector('[data-proactive-image] img')?.naturalWidth>0);
 assert.ok(inputs.length>=2);assert.equal(inputs[1].create,false,'recovery reads cache without submitting generation');
 assert.equal(await image.locator('.image-retry').count(),0);
 await image.evaluate(el=>el.closest('.proactive-recipe').scrollIntoView({block:'center',behavior:'instant'}));
 await p.screenshot({path:out+'/'+engine+'-recommendation-390.png'});
 await p.locator('.proactive-recipe [data-proactive-recipe]').first().click();
 await p.locator('[data-reading-back]').waitFor();
 await p.addStyleTag({url:base+'/mobile/ios.css'});
 await p.evaluate(async()=>{const {installIOSControls}=await import('/mobile/ios-controls.js');document.documentElement.classList.add('native-app','native-ios');window.testNative=installIOSControls({setControls:v=>Promise.resolve({revision:v.revision})})});
 await p.waitForTimeout(100);
 assert.equal(await p.locator('[data-reading-back]').evaluate(el=>!el.classList.contains('ios-native-control')&&getComputedStyle(el).opacity==='1'),true);
 await p.locator('[data-reading-back]').click();
 await p.locator('#workspace-quick-add').waitFor({state:'attached'});
 for(const width of [320,360,390,1366]){
  await p.setViewportSize({width,height:844});await p.waitForTimeout(70);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await p.evaluate(()=>{const a=document.getElementById('workspace-quick-add').getBoundingClientRect(),b=document.getElementById('workspace-new-chat').getBoundingClientRect();return a.left>=0&&a.right<b.left&&b.right<=innerWidth&&a.height>=44&&b.bottom<=innerHeight}),true);
 }
 await p.evaluate(()=>testNative.dispose());
 // Save mixed conversation types through the real local RPC and reload their index.
 const ids=await p.evaluate(async()=>{
  const now=Date.now(),r=await RecipeLibrary.get('10000000-0000-4000-8000-000000000001'),ids=[];
  for(const [i,kind] of ['chat','recipe','chat'].entries()){
   const id=crypto.randomUUID(),m={id:crypto.randomUUID(),role:'user',text:'Audit '+i,createdAt:now+i*1000};ids.push(id);
   const meta=PersistenceModel.metadata({kind,title:'Audit '+i,updated:now+(2-i)*5000,messages:[m],...(kind==='recipe'?{recipe:r}:{})});
   await household.dataRpc('sync_conversation',{cid:id,meta,expected:0,items:[m],recipe_ids:kind==='recipe'?[r.recipeId]:[]});
  }
  await MorzsaPersistence.refresh();return ids;
 });
 await p.setViewportSize({width:390,height:844});await p.locator('nav [data-page=chat]').click();await p.locator('.companion-header-history').click();
 const rows=p.locator('#companion-history .companion-history-items [data-thread]');
 assert.deepEqual((await rows.evaluateAll(els=>els.map(el=>el.dataset.thread))).filter(id=>ids.includes(id)),ids.toReversed());
 for(const id of ids)assert.equal(await p.locator('#companion-history [data-thread="'+id+'"]').count(),1);
 assert.equal(await p.locator('#companion-history').getByText('Receptek',{exact:true}).count(),0);
 await p.locator('#companion-history').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
 await p.screenshot({path:out+'/'+engine+'-history-390.png'});
 await p.locator('#companion-history [data-thread="'+ids[1]+'"]').click();
 await p.waitForFunction(id=>JSON.parse(localStorage.getItem(PersistenceModel.accountKey(household.userId())))?.active===id,ids[1]);
 assert.deepEqual(errors,[]);
 const result={engine,recommendationImage:true,automaticRecovery:true,readerBackIsWeb:true,widths:[320,360,390,1366],mixedHistoryNavigation:true,errors};
 fs.writeFileSync(out+'/'+engine+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await ctx.close();await browser.close()}
