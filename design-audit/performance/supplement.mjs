import fs from 'node:fs';import path from 'node:path';
export async function runSupplement(h){
 const {context,fixture,loaded,settled,nav,capture,metrics,attempt,check,result,write,log,save,run,mode,root}=h;
 if(mode==='soak'){
  await fixture.db.exec('reset role');await fixture.db.query("insert into public.household_records(household_id,bucket,key,value) values ('90000000-0000-4000-8000-000000000001','stock','Tojás','2'),('90000000-0000-4000-8000-000000000001','stock','Tej','2'),('90000000-0000-4000-8000-000000000001','stock','Alma','2')");
  const x=await context({actor:'a',shared:true}),p=x.p;await p.goto(fixture.origin);await settled(p);await p.evaluate(()=>AIMode.set('free'));await settled(p);const start=performance.now();result.soak=[];
  for(let round=0;round<20;round++){
   if(round%5===0){await p.evaluate(()=>MorzsaCompanion.newChat());await settled(p);const answer='Hosszú próba '+round+' sikeres.';fixture.ai.push({stream:[answer.slice(0,8),answer],interval:100,output:{transcript:'Mit főzzek?',answer,operations:[],recipes:[],clarification:''}});await p.locator('#companion-input').fill('Mit főzzek?');await p.locator('#companion-form button[type=submit]').click();await p.getByText(answer,{exact:true}).waitFor({timeout:10000});await settled(p)}
   for(const dest of ['overview','pantry','shopping','recipes','chat'])await nav(p,dest);
   await nav(p,'pantry');await p.locator('[data-pantry-details="Tojás"]').click();await p.locator('#pantry-item-dialog .close').click();await nav(p,'overview');
   if(round%5===0)await capture(p,'soak-'+round);
   const m=await metrics(p);await p.evaluate(()=>{__perf.longTasks.length=0;__perf.events.length=0;__perf.heartbeats.length=0;performance.clearResourceTimings()});await x.cdp.send('HeapProfiler.collectGarbage');
   result.soak.push({round,elapsedMs:performance.now()-start,...await x.cdp.send('Memory.getDOMCounters'),...await x.cdp.send('Runtime.getHeapUsage'),socketCount:x.sockets.length,longTaskCount:m.longTasks.length,maxLongTask:Math.max(0,...m.longTasks.map(t=>t.duration))});save();log('soak '+round+'/20');await p.waitForTimeout(15000);
  }result.soakDurationMs=performance.now()-start;await capture(p,'soak-complete');await x.close();return;
 }
 const x=await context({actor:'c',trace:true}),p=x.p;await p.goto(fixture.origin);await settled(p);
 await attempt('responsive-all-five-views-six-viewports',async()=>{
  result.responsive=[];for(const viewport of [{width:320,height:640},{width:375,height:812},{width:390,height:844},{width:768,height:1024},{width:1280,height:800},{width:1440,height:900}]){await p.setViewportSize(viewport);for(const dest of ['overview','pantry','shopping','recipes','chat']){await nav(p,dest);const m=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));result.responsive.push({viewport,dest,...m});await capture(p,'responsive-'+dest+'-'+viewport.width);check('overflow-'+dest+'-'+viewport.width,m.scrollWidth<=m.width+1,m)}}
 });await p.setViewportSize({width:390,height:844});
 await attempt('empty-chat-read-errors-reproduction',async()=>{let at=fixture.calls.length;for(let i=0;i<3;i++){await p.evaluate(()=>MorzsaCompanion.newChat());await p.waitForTimeout(1500)}result.emptyChatRequests=fixture.calls.slice(at);await capture(p,'empty-chat-after-poll');});
 await x.close('responsive');
 const z=await context({actor:null,trace:true}),q=z.p;await q.goto(fixture.origin);await loaded(q);await nav(q,'overview');
 await attempt('large-list-cpu-profile-reproduction',async()=>{
  result.profileRuns=[];for(const size of [50,250,667]){await q.evaluate(size=>{const items=catalog.slice(0,size);state={...state,stock:Object.fromEntries(items.map(i=>[i.name,2])),cart:items.map(i=>({name:i.name,quantity:1,unit:'db',done:false}))};stockView='home';search='';category='Minden'},size);await nav(q,'overview');
   await z.cdp.send('Profiler.enable');await z.cdp.send('Profiler.start');const at=await q.evaluate(()=>performance.now());await nav(q,'shopping');const profile=(await z.cdp.send('Profiler.stop')).profile;write('traces/shopping-'+size+'.cpuprofile',profile);const m=await metrics(q);result.profileRuns.push({size,screen:'shopping',longTasks:m.longTasks.filter(t=>t.start>=at),mainNodes:m.mainNodes});await capture(q,'profile-shopping-'+size);
   await z.cdp.send('Profiler.start');const before=await q.evaluate(()=>performance.now());await nav(q,'recipes');write('traces/recipes-'+size+'.cpuprofile',(await z.cdp.send('Profiler.stop')).profile);const n=await metrics(q);result.profileRuns.push({size,screen:'recipes',longTasks:n.longTasks.filter(t=>t.start>=before),mainNodes:n.mainNodes});save();
  }
 });await z.close('profile');
 const img=await context({actor:'c'}),ip=img.p;await ip.goto(fixture.origin);await settled(ip);await nav(ip,'overview');
 await attempt('ordered-image-queue-reproduction',async()=>{
  result.orderedImageQueue=await ip.evaluate(async()=>{
   const previous=household.libraryImage,events=[],start=performance.now(),ids=['31111111-1111-4111-8111-111111111111','32222222-2222-4222-8222-222222222222'];let signal;const firstStarted=new Promise(r=>signal=r);
   household.libraryImage=async input=>{events.push({event:'start',id:input.recipeId,t:performance.now()-start});if(input.recipeId===ids[0]){signal();await new Promise(r=>setTimeout(r,2000))}events.push({event:'end',id:input.recipeId,t:performance.now()-start});return {status:'missing'}};
   const mount=(id,i)=>{const host=document.createElement('div');host.style.cssText='position:fixed;top:'+(100+i*120)+'px;left:20px;width:280px;height:100px;z-index:9999';document.body.append(host);RecipeImages.mount(host,{recipeId:id,title:'Audit image '+i,summary:'Próba',minutes:10,servings:2,ingredients:[{name:'Tojás',amount:'2 db'}],steps:['Süsd meg.']},-1,{cacheOnly:true});return host};
   const first=mount(ids[0],0);await firstStarted;const second=mount(ids[1],1);await new Promise(r=>setTimeout(r,2400));first.remove();second.remove();household.libraryImage=previous;return events;
  });check('cache-read-not-blocked-by-prior-image',result.orderedImageQueue.find(e=>e.event==='start'&&e.id.startsWith('322')).t<500,result.orderedImageQueue);
 });
 await attempt('cached-image-detached-dom-retention',async()=>{
  const image=fs.readFileSync(path.join(root,'assets/food/pancake.jpg'));await img.ctx.route('**/storage/v1/object/public/recipe-catalog/audit.jpg',r=>r.fulfill({contentType:'image/jpeg',body:image}));
  await ip.evaluate(()=>{window.__imagePrevious=household.libraryImage;household.libraryImage=async()=>({status:'ready',url:MORZSA_CLOUD.url+'/storage/v1/object/public/recipe-catalog/audit.jpg',expiresAt:Date.now()+60000});window.__mountAuditImage=()=>{const host=document.createElement('div');host.style.cssText='position:fixed;top:100px;left:20px;width:280px;height:100px;z-index:9999';document.body.append(host);RecipeImages.mount(host,{recipeId:'33333333-3333-4333-8333-333333333333',title:'Cached audit image',summary:'Audit',minutes:10,servings:2,ingredients:[{name:'Tojás',amount:'2 db'}],steps:['Süsd meg.']});return host};window.__warmImage=__mountAuditImage()});await ip.waitForTimeout(400);await ip.evaluate(()=>{__warmImage.remove();delete window.__warmImage});await img.cdp.send('HeapProfiler.collectGarbage');const before=await img.cdp.send('Memory.getDOMCounters');
  await ip.evaluate(()=>{for(let i=0;i<100;i++){const host=__mountAuditImage();host.remove()}});await ip.waitForTimeout(400);await img.cdp.send('HeapProfiler.collectGarbage');const after=await img.cdp.send('Memory.getDOMCounters');result.imageRetention={before,after,repeatedMounts:100};check('cached-image-releases-detached-dom',after.nodes-before.nodes<100,result.imageRetention);await ip.evaluate(()=>{household.libraryImage=__imagePrevious;delete window.__imagePrevious;delete window.__mountAuditImage});
 });await img.close();
}
