import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
export async function runJourneys(h){
 const {context,fixture,loaded,settled,nav,capture,metrics,attempt,check,result,write,log,save,run,stock}=h;
 const timing=async(name,fn)=>{const t=performance.now();const value=await fn();result.actions.push({name,duration:performance.now()-t});return value};
 const x=await context({actor:'c',trace:true}),p=x.p;await p.goto(fixture.origin);await loaded(p);await settled(p);await p.evaluate(()=>AIMode.set('free'));
 await attempt('J3-inventory-add-edit-remove-persist',async()=>{
  await nav(p,'pantry');await p.locator('#catalog-search').fill('Cukor');await p.locator('[data-pantry-details="Cukor"]').click();
  await timing('inventory-add-local',async()=>{await p.locator('#pantry-item-dialog [data-value="2"]').click();await p.waitForFunction(()=>state.stock.Cukor===2)});
  await p.locator('#pantry-item-dialog [data-value="1"]').click();await p.waitForFunction(()=>state.stock.Cukor===1);await capture(p,'inventory-edited');await p.locator('#pantry-item-dialog .close').click();
  await p.reload();await settled(p);assert.equal(await p.evaluate(()=>state.stock.Cukor),1);await nav(p,'pantry');await p.locator('#catalog-search').fill('Cukor');await p.locator('[data-pantry-toggle="Cukor"]').click();await p.waitForFunction(()=>state.stock.Cukor===0);await p.reload();await settled(p);assert.equal(await p.evaluate(()=>state.stock.Cukor),0);
 });
 await attempt('J4-shopping-batch-edit-rapid-persist-finish',async()=>{
  await nav(p,'shopping');await p.locator('#workspace-quick-add').click();const input=p.locator('#workspace-entry input');await input.fill('Tej, Kenyér, Alma');await input.press('Enter');await timing('shopping-batch-local',()=>p.locator('.workspace-entry-save').click());await p.waitForFunction(()=>state.cart.length===3);await capture(p,'shopping-added');
  await p.locator('[data-item="Tej"] .shopping-product-open').click();await p.locator('#shopping-item-form [name=quantity]').fill('0.5');await p.locator('#shopping-item-form [name=unit]').selectOption('l');await p.locator('#shopping-item-form .primary').click();
  assert.equal(await p.evaluate(()=>state.cart.find(i=>i.name==='Tej').quantity),500);
  await p.locator('[data-item="Kenyér"] .shopping-product-open').click();await p.locator('[data-shopping-edit-remove]').click();await p.waitForFunction(()=>state.cart.length===2);
  await p.reload();await settled(p);await nav(p,'shopping');assert.equal(await p.evaluate(()=>state.cart.length),2);await p.locator('[data-item="Tej"] [data-cart]').click();await p.waitForFunction(()=>state.cart.find(i=>i.name==='Tej').done);await p.reload();await settled(p);await nav(p,'shopping');assert.equal(await p.evaluate(()=>state.cart.find(i=>i.name==='Tej').done),true);
  await p.locator('[data-start-shopping]').click();await p.locator('[data-finish-shopping]').click();await capture(p,'shopping-finish-review');await p.locator('#finish-checked').click();await p.waitForFunction(()=>state.history.length===1&&state.stock.Tej===2);assert.equal(await p.evaluate(()=>state.cart.some(i=>i.name==='Tej')),false);
 });
 await attempt('J5-recipe-feed-detail-servings-shopping',async()=>{
  await nav(p,'recipes');await p.locator('[data-feed-tab=browse]').click();await p.locator('[data-feed-recipe]').first().waitFor();await timing('recipe-open',()=>p.locator('[data-feed-recipe]').first().click());await p.locator('[data-start-cooking]').waitFor();await capture(p,'recipe-detail');
  await p.locator('[data-portions-delta="1"]').click();await p.locator('[data-workspace-ingredients]').click();await capture(p,'recipe-ingredients');
  const before=await p.evaluate(()=>state.cart.length);await p.locator('[data-recipe-missing]').click();assert.equal(await p.evaluate(()=>state.cart.length),before);await p.locator('[data-recipe-missing]').click();assert.ok(await p.evaluate(n=>state.cart.length>n,before));await p.locator('[data-ingredients-close]').click();await settled(p);await nav(p,'shopping');await capture(p,'recipe-linked-shopping');
 });
 await attempt('J6-ai-stream-and-independent-navigation',async()=>{
  await p.evaluate(()=>MorzsaCompanion.newChat());await settled(p);const output={transcript:'Mit főzzek?',answer:'Audit válasz. Használd fel a tojást és a rizst.',operations:[],recipes:[],clarification:''};fixture.ai.push({delay:1800,stream:['Audit ','Audit válasz. ','Audit válasz. Használd fel a tojást és a rizst.'],interval:300,output});
  await p.locator('#companion-input').fill('Mit főzzek?');const start=performance.now(),calls=fixture.calls.length;await p.locator('#companion-form button[type=submit]').click();await p.waitForFunction(()=>document.querySelector('.companion-thinking')||document.querySelector('button[aria-label="Válasz leállítása"]'),{},{timeout:10000});
  const navMs=await nav(p,'pantry');await nav(p,'shopping');await nav(p,'chat');await p.getByText('Audit válasz. Használd fel a tojást és a rizst.',{exact:true}).first().waitFor({timeout:12000});const visible=performance.now()-start;await settled(p);result.aiStream={visibleCompleteMs:visible,navigateWhilePendingMs:navMs,calls:fixture.calls.slice(calls)};await capture(p,'ai-stream-complete');assert.ok(navMs<1000);assert.equal(fixture.calls.slice(calls).filter(c=>c.path.endsWith('/voice-command')&&c.method==='POST').length,1);
 });
 await attempt('J6-ai-failure-retry',async()=>{
  await p.evaluate(()=>MorzsaCompanion.newChat());await settled(p);fixture.ai.push({error:'VOICE_PROVIDER_BUSY'});await p.locator('#companion-input').fill('Sikertelen audit kérdés');await p.locator('#companion-form button[type=submit]').click();await p.locator('[data-retry]').waitFor({timeout:12000});await capture(p,'ai-failed-retry');
  fixture.ai.push({output:{transcript:'Sikertelen audit kérdés',answer:'A próba újrapróbálása sikerült.',operations:[],recipes:[],clarification:''}});await p.locator('[data-retry]').click();await p.getByText('A próba újrapróbálása sikerült.',{exact:true}).waitFor({timeout:12000});await settled(p);await capture(p,'ai-retry-recovered');
 });
 await attempt('J6-ai-cancellation',async()=>{
  await p.evaluate(()=>MorzsaCompanion.newChat());await settled(p);fixture.ai.push({delay:3500,output:{transcript:'Lassú válasz',answer:'Késői audit válasz.',operations:[],recipes:[],clarification:''}});await p.locator('#companion-input').fill('Lassú válasz');const providerStarted=p.waitForRequest(r=>r.url().endsWith('/functions/v1/voice-command')&&r.method()==='POST');await p.locator('#companion-form button[type=submit]').click();await providerStarted;await p.locator('button[aria-label="Válasz leállítása"]').waitFor({timeout:10000});await p.locator('button[aria-label="Válasz leállítása"]').click();await p.locator('[data-retry]').waitFor({timeout:10000});assert.equal(await p.locator('#companion-input').isEnabled(),true);await capture(p,'ai-cancelled');await p.waitForTimeout(3600);
 });
 await attempt('J6-ai-preflight-delay',async()=>{
  await p.evaluate(()=>MorzsaCompanion.newChat());await settled(p);fixture.rules.push({match:'/rpc/',delay:600,remaining:-1});fixture.ai.push({output:{transcript:'Előkészítési próba',answer:'Előkészítési próba válasza.',operations:[],recipes:[],clarification:''}});
  await p.locator('#companion-input').fill('Előkészítési próba');const start=performance.now(),at=fixture.calls.length;await p.locator('#companion-form button[type=submit]').click();await p.waitForTimeout(800);result.aiPreflight={after800ms:await p.evaluate(()=>({text:document.querySelector('#companion-input')?.value,submitDisabled:document.querySelector('#companion-form button[type=submit]')?.disabled,thinking:!!document.querySelector('.companion-thinking'),stop:!!document.querySelector('button[aria-label="Válasz leállítása"]')}))};await capture(p,'ai-preflight-800ms');
  await p.getByText('Előkészítési próba válasza.',{exact:true}).waitFor({timeout:20000});result.aiPreflight.totalMs=performance.now()-start;result.aiPreflight.calls=fixture.calls.slice(at);fixture.rules.length=0;await settled(p);
 });
 write('journey-metrics.json',await metrics(p));await x.close('journeys');
 await shared();await scaling();await images();
 async function shared(){
  const a=await context({actor:'a',shared:true,trace:true}),b=await context({actor:'b',shared:true});await a.p.goto(fixture.origin);await b.p.goto(fixture.origin);await settled(a.p);await settled(b.p);await a.p.waitForTimeout(900);await nav(a.p,'shopping');await nav(b.p,'shopping');
  await attempt('J4-shared-rapid-add-realtime-readback',async()=>{
   const start=performance.now();await a.p.locator('#workspace-quick-add').click();await a.p.locator('#workspace-entry input').fill('Tej, Kenyér, Alma');await a.p.locator('#workspace-entry input').press('Enter');await a.p.locator('.workspace-entry-save').click();await a.p.waitForFunction(()=>household.cartPending===0&&!household.busy);await b.p.waitForFunction(()=>state.cart.length===3,{},{timeout:10000});result.realtimePropagationMs=performance.now()-start;await capture(b.p,'second-client-synced');assert.equal(await b.p.evaluate(()=>state.cart.filter(i=>i.name==='Tej').length),1);
  });
  await attempt('J4-shared-offline-outbox-reconnect',async()=>{
   await a.cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});await a.p.locator('#workspace-quick-add').click();await a.p.locator('#workspace-entry input').fill('Vaj');await a.p.locator('#workspace-entry input').press('Enter');await a.p.locator('.workspace-entry-save').click();await a.p.waitForTimeout(800);assert.ok(await a.p.evaluate(()=>household.cartPending>0));await capture(a.p,'offline-outbox');
   await a.cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await a.p.evaluate(()=>{dispatchEvent(new Event('online'));household.retryCart()});await a.p.waitForFunction(()=>household.cartPending===0&&!household.busy,{},{timeout:10000});await b.p.waitForFunction(()=>state.cart.some(i=>i.name==='Vaj'),{},{timeout:10000});await a.p.reload();await settled(a.p);assert.ok(await a.p.evaluate(()=>state.cart.some(i=>i.name==='Vaj')));
  });
  await attempt('realtime-burst-fanout-and-idle-polling',async()=>{
   await nav(a.p,'overview');await a.p.waitForTimeout(700);let at=fixture.calls.length;for(let i=0;i<20;i++)a.signal();await a.p.waitForTimeout(1300);result.realtimeBurst={events:20,calls:fixture.calls.slice(at),sockets:a.sockets.length};
   at=fixture.calls.length;await a.p.waitForTimeout(16500);result.idlePolling={durationMs:16500,calls:fixture.calls.slice(at),twoClients:true};check('realtime-one-household-plus-one-chat-socket',a.sockets.length===2,{sockets:a.sockets.length});
  });
  await attempt('J3-shared-slow-pantry-action-blocking',async()=>{
   await nav(a.p,'pantry');await a.p.locator('#catalog-search').fill('Rizs');await a.p.locator('[data-pantry-details="Rizs"]').click();fixture.rules.push({match:'/rest/',delay:450,remaining:-1});const at=fixture.calls.length,start=performance.now();await a.p.locator('#pantry-item-dialog [data-value="2"]').click();await a.p.waitForTimeout(600);result.sharedPantryPending=await a.p.evaluate(()=>({cloudBusy:household.busy,buttons:[...document.querySelectorAll('#pantry-item-dialog button')].map(b=>({text:b.textContent,disabled:b.disabled}))}));await capture(a.p,'shared-pantry-saving');await a.p.waitForFunction(()=>state.stock.Rizs===2&&!household.busy&&!document.querySelector('#pantry-item-dialog .close').disabled,{},{timeout:15000});result.sharedPantry={durationMs:performance.now()-start,calls:fixture.calls.slice(at)};fixture.rules.length=0;await a.p.locator('#pantry-item-dialog .close').click();
  });
  await a.close('shared');await b.close();
 }
 async function scaling(){
  const z=await context({actor:null,trace:true}),p=z.p;await p.goto(fixture.origin);await loaded(p);await nav(p,'overview');
  const memory=async(label)=>{await z.cdp.send('HeapProfiler.collectGarbage');const dom=await z.cdp.send('Memory.getDOMCounters'),heap=await z.cdp.send('Runtime.getHeapUsage');result.memory.push({label,...dom,...heap,sockets:z.sockets.length})};
  await attempt('J7-long-session-125-navigation-dialog-cycles',async()=>{
   await memory('baseline');const start=performance.now();for(let n=0;n<25;n++){for(const d of ['pantry','shopping','recipes','chat','overview'])await nav(p,d);if(n%5===0){await nav(p,'pantry');await p.locator('[data-pantry-details="Tojás"]').click();await p.locator('#pantry-item-dialog .close').click();await nav(p,'overview');await memory('cycle-'+n);log('long session '+n+'/25');save()}}result.longSessionMs=performance.now()-start;await memory('end');await capture(p,'long-session-end');write('long-session-metrics.json',await metrics(p));
  });
  await attempt('large-pantry-and-list-stress',async()=>{
   result.scaling=[];for(const size of [50,250,667,2000]){await p.evaluate(size=>{const custom=Array.from({length:Math.max(0,size-catalog.length)},(_,i)=>({name:'Audit termék '+i,category:'Saját tételek'})),items=[...catalog,...custom].slice(0,size);state={...state,custom,stock:Object.fromEntries(items.map(i=>[i.name,2])),cart:items.map(i=>({name:i.name,quantity:1,unit:'db',done:false}))};search='';category='Minden';stockView='home'},size);for(const dest of ['pantry','shopping','recipes']){const before=await p.evaluate(()=>performance.now()),ms=await nav(p,dest),m=await metrics(p);result.scaling.push({size,dest,navigationMs:ms,mainNodes:m.mainNodes,longTasks:m.longTasks.filter(t=>t.start>=before),maxHeartbeatMs:Math.max(0,...m.heartbeat.filter(t=>t.start>=before).map(t=>t.delay))});if(dest==='pantry'){await timing('pantry-search-'+size,()=>p.locator('#catalog-search').fill('tej'));await p.locator('#catalog-search').fill('')}}log('size '+size+' complete');save()}await capture(p,'large-dataset');
  });await z.close('long-session');
 }
 async function images(){
  const z=await context({actor:'c'}),p=z.p;await p.goto(fixture.origin);await settled(p);await nav(p,'overview');
  await attempt('image-serial-queue-blocks-unrelated-cache-read',async()=>{
   const data=await p.evaluate(async()=>{
    const saved=household.libraryImage,events=[],start=performance.now(),ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
    household.libraryImage=async input=>{events.push({event:'start',id:input.recipeId,t:performance.now()-start});if(input.recipeId===ids[0])await new Promise(r=>setTimeout(r,2000));events.push({event:'end',id:input.recipeId,t:performance.now()-start});return {status:'missing'}};
    const hosts=[];for(const [i,id] of ids.entries()){const host=document.createElement('div');host.style.cssText='position:fixed;top:'+(100+i*120)+'px;left:20px;width:280px;height:100px;background:white;z-index:9999';document.body.append(host);RecipeImages.mount(host,{recipeId:id,title:'Audit image '+i,summary:'Próba',minutes:10,servings:2,ingredients:[{name:'Tojás',amount:'2 db'}],steps:['Süsd meg.']},-1,{cacheOnly:true});hosts.push(host);if(i===0)while(!events.some(e=>e.event==='start'))await new Promise(r=>setTimeout(r,10))}
    await new Promise(r=>setTimeout(r,2500));hosts.forEach(h=>h.remove());household.libraryImage=saved;return events;
   });result.imageQueue=data;assert.equal(data.filter(x=>x.event==='start').length,2);check('image-cache-read-is-independent',data.find(e=>e.event==='start'&&e.id.startsWith('222')).t<500,{events:data});
  });await z.close();
 }
}
