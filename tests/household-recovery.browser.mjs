// Synthetic native sessions and isolated SQL data; no production or AI traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium,webkit} from '../design-audit/node_modules/playwright/index.mjs';
import {startFixture,actors,householdId} from '../design-audit/fixture.mjs';
import {auditContext} from '../design-audit/browser.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'build/household-recovery');
fs.mkdirSync(out,{recursive:true});
const fixture=await startFixture({repoRoot:root}),checks=[],errors=[];
await fixture.db.query("insert into public.household_records(household_id,bucket,key,value,revision) values($1,'stock','Rizs','2',1),($1,'cart','Tej',$2,1)",[householdId,JSON.stringify({name:'Tej',quantity:2,done:false})]);
const local={stock:{Tojás:1},cart:[{name:'Alma',done:false}],likes:[],custom:[],history:[],skips:[],chats:{}};
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log('PASS '+name)};
async function open(browser,{preference='missing',fail=''}={}){
 const {context}=await auditContext(browser,fixture.origin,{actor:'a',stock:local});
 await context.addInitScript(({preference,uid})=>{
  if(!sessionStorage.getItem('recovery-seeded')){
   sessionStorage.setItem('recovery-seeded','1');
   if(preference==='missing')localStorage.removeItem('morzsa-last-household-'+uid);
   if(preference==='broken')localStorage.setItem('morzsa-last-household-'+uid,'invalid json');
   const raw=localStorage.getItem('morzsa-v2');localStorage.setItem('morzsa-v1',raw);localStorage.removeItem('morzsa-v2');
  }
  window.nativeStored=JSON.parse(localStorage.getItem('morzsa-session'));
  window.MorzsaNative={loadSession:async()=>nativeStored,saveSession:async value=>{window.nativeStored=value},onAuth:async()=>{}};
  document.addEventListener('DOMContentLoaded',()=>document.documentElement.classList.add('native-app','native-ios'),{once:true});
 },{preference,uid:actors.a});
 const flags={fail,expired:false,rejectRenewed:false,refreshes:0,holdRefresh:null,aiReject:false};
 await context.route(fixture.origin+'/rest/**',async route=>{
  const req=route.request(),url=new URL(req.url()),access=req.headers().authorization;
  if(flags.fail&&url.pathname.includes(flags.fail))return route.abort('failed');
  if(flags.expired&&(access==='Bearer audit-a'||flags.rejectRenewed))return route.fulfill({status:401,json:{code:'PGRST301',message:'JWT expired'}});
  if(access==='Bearer audit-a-renewed')return route.fulfill({response:await route.fetch({headers:{...req.headers(),authorization:'Bearer audit-a'}})});
  return route.continue();
 });
 await context.route(fixture.origin+'/auth/v1/token?grant_type=refresh_token',async route=>{
  flags.refreshes++;if(flags.holdRefresh)await flags.holdRefresh;else await new Promise(r=>setTimeout(r,100));
  await route.fulfill({json:{access_token:'audit-a-renewed',refresh_token:'synthetic-refresh',expires_in:3600,user:{id:actors.a,email:'a@audit.invalid'}}});
 });
 await context.route(fixture.origin+'/functions/**',route=>flags.aiReject?route.fulfill({status:401,json:{code:'PGRST301',message:'Provider rejected request'}}):route.continue());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(fixture.origin);await page.addStyleTag({content:fs.readFileSync(path.join(root,'mobile/ios.css'),'utf8')});
 return {context,page,flags};
}
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==='chromium'?{channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome',headless:true}:{headless:true});
 try{
  for(const failure of ['households','household_records']){
   const {context,page:p,flags}=await open(browser,{fail:failure});
   try{
    await p.waitForFunction(()=>!household.busy&&document.querySelector('#cloud-status button'));
    check(await p.evaluate(()=>!household.active&&state.stock.Tojás===1&&state.cart[0].name==='Alma'),name+' failed '+failure+' keeps legacy local save');
    check((await p.locator('#cloud-status').innerText()).includes('helyi adatok'),name+' failed load explains the visible data');
    flags.fail='';
    if(failure==='households')await p.evaluate(()=>window.dispatchEvent(new Event('online')));else await p.locator('#cloud-status button').click();
    await p.waitForFunction(()=>household.active&&!household.busy&&state.stock.Rizs===2);
    check(await p.evaluate(()=>!state.stock.Tojás&&state.cart[0].name==='Tej'),name+' retry loads shared stock/list without importing local data');
    check(await p.locator('#cloud-status').isHidden(),name+' successful retry clears failure');
    if(failure==='households'){
     await p.evaluate(()=>{window.testFetch=window.fetch;window.fetch=(url,options)=>String(url).includes('/rest/v1/households?')?Promise.reject(new DOMException('signal is aborted without reason','AbortError')):testFetch(url,options)});
     await p.locator('#household-button').evaluate(el=>el.click());await p.locator('#retry-households').waitFor({state:'visible'});
     check((await p.locator('.household-error').innerText()).includes('túl sokáig'),name+' household menu explains an aborted read');
     check(await p.evaluate(()=>state.stock.Rizs===2&&!!household.active),name+' menu timeout keeps the active shared pantry');
     await p.evaluate(()=>window.fetch=window.testFetch);await p.locator('#retry-households').click();await p.locator('[data-house]').waitFor({state:'visible'});
     check(await p.locator('.household-error').innerText()==='',name+' household menu retries without a permanent loading label');
     await p.locator('#household-dialog .close').click();
    }
    await p.evaluate(()=>window.dispatchEvent(new Event('online')));await p.waitForFunction(()=>!household.busy);
    check(await p.evaluate(()=>JSON.parse(localStorage.getItem('morzsa-v1')).stock.Tojás===1),name+' repeated resume preserves original local pantry');
    for(const width of [320,390]){
     await p.setViewportSize({width,height:844});
     for(const screen of ['pantry','shopping','overview','recipes','chat']){
      await p.locator('nav [data-page='+screen+']').evaluate(el=>el.click());await p.evaluate(()=>scrollTo(0,0));
      await p.waitForFunction(()=>!document.documentElement.classList.contains('shell-scrolled'));
      check(await p.locator('.app>header').evaluate(el=>getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'),name+' transparent header '+screen+' '+width);
     }
    }
    await p.locator('nav [data-page=pantry]').evaluate(el=>el.click());await p.screenshot({path:path.join(out,name+'-pantry.png')});
    await p.addStyleTag({content:'#main{min-height:1600px}'});await p.evaluate(()=>scrollTo(0,250));
    await p.waitForFunction(()=>document.documentElement.classList.contains('shell-scrolled'));
    check(await p.locator('.app>header').evaluate(el=>getComputedStyle(el).backgroundColor!=='rgba(0, 0, 0, 0)'),name+' scrolled header protects text contrast');
   }finally{await context.close()}
  }
  for(const preference of ['local','broken']){
   const {context,page:p}=await open(browser,{preference});
   try{
    await p.waitForFunction(()=>household.userId()&&!household.busy);await p.evaluate(()=>window.dispatchEvent(new Event('online')));
    if(preference==='local')check(await p.evaluate(()=>!household.active&&state.stock.Tojás===1),name+' explicit local kitchen survives resume');
    else {await p.waitForFunction(()=>household.active);check(await p.evaluate(()=>state.stock.Rizs===2),name+' malformed preference recovers shared kitchen')}
   }finally{await context.close()}
  }
  const {context,page:p,flags}=await open(browser,{preference:'local'});
  try{
   await p.waitForFunction(()=>household.userId()&&MorzsaPersistence.status()==='synced');
   flags.expired=true;
   await p.evaluate(()=>Promise.all([household.dataRead('households?select=id,name'),household.dataRpc('conversation_index',{page_offset:0})]));
   check(flags.refreshes===1,name+' concurrent rejected JWTs refresh only once');
   check(await p.evaluate(()=>nativeStored.access_token==='audit-a-renewed'),name+' refreshed session is saved in native vault');
   flags.rejectRenewed=true;
   const rejected=await p.evaluate(()=>household.dataRpc('conversation_index',{page_offset:0}).then(()=>null,e=>({code:e.code,httpStatus:e.httpStatus})));
   check(rejected.code==='PGRST301'&&rejected.httpStatus===401&&flags.refreshes===2,name+' repeated rejection stops after one retry and preserves error code');
   flags.aiReject=true;const before=flags.refreshes;
   await p.evaluate(()=>household.voiceCommand({text:'Synthetic request'}).catch(()=>{}));
   check(flags.refreshes===before,name+' provider requests are never replayed for JWT-like errors');
  }finally{await context.close()}
  const late=await open(browser,{preference:'local'});
  try{
   const {page:p,flags}=late;await p.waitForFunction(()=>household.userId()&&MorzsaPersistence.status()==='synced');
   await p.locator('#household-button').evaluate(el=>el.click());await p.locator('#cloud-signout').waitFor({state:'attached'});
   let release;flags.holdRefresh=new Promise(r=>release=r);flags.expired=true;
   await p.evaluate(()=>{window.delayedRequest=household.dataRpc('conversation_index',{page_offset:0}).then(()=>false,()=>true)});
   await new Promise(async(resolve,reject)=>{const deadline=Date.now()+5000;while(!flags.refreshes){if(Date.now()>deadline)return reject(Error('No refresh'));await new Promise(r=>setTimeout(r,20))}resolve()});
   await p.locator('#cloud-signout').evaluate(el=>el.click());await p.waitForFunction(()=>!household.userId());release();
   check(await p.evaluate(()=>delayedRequest)&&await p.evaluate(()=>nativeStored===null),name+' late refresh cannot restore a signed-out native session');
  }finally{await late.context.close()}
 }finally{await browser.close()}
}
check(errors.length===0,'No browser runtime errors: '+errors.join('; '));
check(!fixture.calls.some(c=>c.path.includes('apply_household_changes')),'Recovery never writes or imports shared pantry/list data');
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors},null,2));
await fixture.close();
console.log('Household recovery passed: '+checks.length+' checks.');
