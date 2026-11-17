import {chromium,webkit} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {startFixture,actors} from '../performance/fixture.mjs';
const root=path.resolve(import.meta.dirname,'../..'),mode=process.argv[2]||'after',engine=process.argv[3]||'chromium';
const out=path.join(root,'design-audit/runs/mobile-'+mode+'-'+engine);fs.mkdirSync(out,{recursive:true});
const fixture=await startFixture({repoRoot:process.env.MORZSA_MOBILE_BASELINE_ROOT||root});
const recipe={title:'Almás palacsinta',summary:'Egyszerű vacsora két főre.',minutes:25,servings:2,equipment:['Serpenyő'],ingredients:[{name:'Alma',amount:'2 db'},{name:'Tojás',amount:'2 db'}],steps:['Készítsd elő a hozzávalókat.','Süsd át a palacsintát.'],stepTitles:['Előkészítés','Sütés']};
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),now=Date.now();
for(let i=1;i<=130;i++){
 const meta={kind:i<=6?'recipe':'chat',title:i<=6?recipe.title:i<12?'':'Vacsoraötlet '+i,language:'hu',updated:now-i*1000,...(i<=6?{recipe,status:i===1?'completed':'active',cookingStep:1,completedSteps:[0],cooking:{phase:i<=2?'completion':'guided',...(i===3?{activity:'paused',activityAt:now}:{}),timers:[],feedback:{notes:'',householdFavourite:false}}}:{})};
 await fixture.db.query('insert into public.conversations(id,owner_id,metadata,updated_at) values($1,$2,$3,to_timestamp($4))',[id(i),actors.c,JSON.stringify(meta),(now-i*1000)/1000]);
 if(i===7)await fixture.db.query('insert into public.conversation_messages(id,conversation_id,body) values($1,$2,$3)',[id(1001),id(i),JSON.stringify({role:'user',text:'Mit főzzek cukkiniből?',createdAt:now-7000,recipes:[]})]);
}
const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'}:{})});
const result={baseline:mode==='before',engine,checks:[],errors:[],sizes:[],metrics:{}};
const check=(name,ok)=>{result.checks.push({name,ok});if(mode!=='before')assert.ok(ok,name)};
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===fixture.origin?r.continue():r.abort());await ctx.routeWebSocket('**/*',ws=>ws.close());
 await ctx.addInitScript(({user})=>{localStorage.setItem('morzsa-introduction-v1','done');localStorage.setItem('morzsa-ai-mode','plus');localStorage.setItem('morzsa-session',JSON.stringify({access_token:'audit-c',expires_at:9999999999,user:{id:user,email:'c@audit.invalid'}}));localStorage.setItem('morzsa-v1',JSON.stringify({stock:{Alma:2,Tojás:1,Tej:2},cart:[{name:'Liszt',quantity:1,unit:'kg',done:false}],custom:[],history:[],likes:[]}));},{user:actors.c});
 const p=await ctx.newPage();p.on('pageerror',e=>result.errors.push(e.message));await p.goto(fixture.origin);await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
 const shot=async name=>{await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));return p.screenshot({path:path.join(out,name+'.png')})};
 await p.evaluate(()=>MorzsaCompanion.newChat());await p.locator('#companion-input').blur();await shot('chat');
 await p.evaluate(()=>MorzsaCompanion.openHistory());await shot('history');
 result.metrics.historyRows=await p.locator('#companion-history [data-thread]').count();check('History DOM has at most 30 initial rows',result.metrics.historyRows<=30);
 await p.locator('#companion-history [data-close]').click();
 await p.setViewportSize({width:1280,height:800});await p.waitForTimeout(250);
 result.metrics.historyRenderMs=await p.evaluate(()=>{const samples=[];for(let i=0;i<12;i++){const start=performance.now();MorzsaCompanion.openHistory();samples.push(performance.now()-start)}return samples.sort((a,b)=>a-b)[6]});
 result.metrics.resizeHistoryMutations=await p.evaluate(async()=>{let count=0;const o=new MutationObserver(rs=>count+=rs.filter(r=>r.type==='childList').length);o.observe(document.querySelector('#companion-history-rail'),{childList:true,subtree:true});for(let i=0;i<20;i++){dispatchEvent(new Event('resize'));await new Promise(requestAnimationFrame)}o.disconnect();return count});
 check('Resize does not rebuild history',result.metrics.resizeHistoryMutations===0);
 for(const [width,height] of [[320,640],[375,812],[390,844],[430,932],[768,1024],[1280,800],[1440,900]]){
  await p.setViewportSize({width,height});
  for(const dest of ['overview','shopping','chat','pantry','recipes']){
   await p.evaluate(dest=>document.querySelector('nav [data-page="'+dest+'"]').click(),dest);await p.waitForTimeout(120);
   const geo=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).slice(-12).map(el=>({tag:el.tagName,cls:el.className,id:el.id,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width,text:el.textContent.slice(0,100)})),active:document.querySelector('nav button.active')?.dataset.page}));result.sizes.push({width,height,dest,...geo});if(geo.overflow)await p.screenshot({path:path.join(out,'overflow-'+width+'-'+dest+'.png')});check(width+' '+dest+' no horizontal overflow',!geo.overflow);check(width+' '+dest+' active destination',geo.active===dest);
   if(width===390){await p.evaluate(()=>scrollTo(0,0));await shot(dest);if(dest==='pantry'){await p.locator('.pantry-tools summary').click();await shot('pantry-menu');const overlap=await p.locator('.pantry-tools').evaluate(el=>{const rs=[...el.querySelectorAll('button,select')].filter(b=>b.getBoundingClientRect().height).map(b=>b.getBoundingClientRect());return rs.some((a,i)=>rs.some((b,j)=>i!==j&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top))});check('Pantry menu controls do not overlap',!overlap);await p.locator('.pantry-tools summary').click()}}
   if(mode!=='before'){
    await p.evaluate(()=>{const end=document.createElement('div');end.id='mobile-end-check';end.style.height='44px';document.querySelector('#main').append(end);scrollTo(0,document.documentElement.scrollHeight)});await p.waitForTimeout(80);
    check(width+' '+dest+' last action clears navigation',await p.evaluate(()=>{const end=document.querySelector('#mobile-end-check').getBoundingClientRect(),nav=document.querySelector('.app>nav')?.getBoundingClientRect();return !nav?.height||end.bottom<=nav.top-8}));await p.locator('#mobile-end-check').evaluate(el=>el.remove());
   }
   await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await p.waitForTimeout(60);if(width===390&&dest==='overview')await shot('long-page-bottom');
  }
 }
 if(mode!=='before'){
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>MorzsaCompanion.newChat());await p.locator('#companion-input').blur();
  await p.evaluate(()=>MorzsaCompanion.openHistory());const history=p.locator('#companion-history');
  await history.locator('[data-more-local]').click();check('History increment reveals 60 rows',await history.locator('[data-thread]').count()===60);
  await history.locator('[data-history-toggle-search]').click();await history.locator('[data-history-search]').fill('Vacsoraötlet 90');check('Search finds a row beyond first render page',await history.locator('[data-thread]').count()===1);
  await history.locator('[data-history-search]').fill('Vacsoraötlet 130');await history.locator('[data-more-history]').click();await p.waitForTimeout(800);
  check('Older server page remains searchable',await history.locator('[data-thread]').count()===1);
  await history.locator('[data-close]').click();await p.evaluate(()=>MorzsaCompanion.openThread('10000000-0000-4000-8000-000000000007'));await p.waitForTimeout(500);
  await p.evaluate(()=>MorzsaCompanion.openHistory());check('Loaded legacy title derived from message',await history.locator('[aria-current=true]').textContent().then(x=>x.includes('Mit főzzek cukkiniből?')));await history.locator('[data-close]').click();
  await p.evaluate(()=>MorzsaCompanion.openThread('10000000-0000-4000-8000-000000000004'));await p.locator('[data-pause-cooking]').click();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
  await p.evaluate(()=>dashboardGo('recipes'));const recipeCounts=await p.locator('.recipe-resume').evaluate(el=>[el.dataset.cookingActive,el.dataset.cookingPaused]);
  await p.evaluate(()=>dashboardGo('overview'));check('Overview and recipes count the same sessions',JSON.stringify(await p.locator('.cooking-resume-card').evaluate(el=>[el.dataset.cookingActive,el.dataset.cookingPaused]))===JSON.stringify(recipeCounts));
  await p.evaluate(()=>MorzsaCompanion.openThread('10000000-0000-4000-8000-000000000004'));check('Resume restores step two',await p.locator('[data-cooking-step="1"]').getAttribute('aria-current')==='step');
  await p.locator('.cooking-task-dock [data-complete-step]').click();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
  check('Completed cook excluded from resumable sessions',await p.evaluate(()=>!CookingSession.sessions(MorzsaCompanion.recipeThreads()).all.some(t=>t.id==='10000000-0000-4000-8000-000000000004')));
  const rows=await fixture.db.query('select metadata from public.conversations where id=$1',[id(4)]);check('Completion persists on the existing server schema',rows.rows[0].metadata.status==='completed');
  const output={answer:'Morzsa válasza a tesztben. '.repeat(90),transcript:'Mit főzzek ma?',recipes:[],operations:[],clarification:''};
  await p.evaluate(()=>MorzsaCompanion.newChat());await p.locator('#companion-input').blur();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');fixture.ai.push({delay:1200,output});const from=fixture.calls.length;
  await p.locator('#companion-input').fill(output.transcript);await p.locator('#companion-form').evaluate(el=>el.requestSubmit());await p.locator('[data-action=stop]').waitFor();
  await p.evaluate(()=>document.querySelector('nav [data-page=pantry]').click());check('Pantry stays interactive during AI wait',await p.locator('#catalog-search').isVisible());
  await p.evaluate(()=>document.querySelector('nav [data-page=chat]').click());await p.locator('[data-action=send]').waitFor();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
  check('Exactly one AI dispatch for one send',fixture.calls.slice(from).filter(c=>c.method==='POST'&&c.path.includes('/functions/v1/plus-assistant')).length===1);
  fixture.ai.push({error:'AUDIT_FAILURE'});await p.locator('#companion-input').fill('És még?');await p.locator('#companion-form').evaluate(el=>el.requestSubmit());await p.locator('[data-retry]').waitFor();
  fixture.ai.push({output});await p.locator('[data-retry]').click();await p.locator('[data-action=send]').waitFor();check('AI failure has a working retry',await p.locator('[data-retry]').count()===0);
  await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
 }
 if(mode!=='before'&&engine==='chromium'){
  const cdp=await ctx.newCDPSession(p),listeners=async()=>JSON.parse((await cdp.send('Runtime.evaluate',{expression:'JSON.stringify([window,visualViewport].map(t=>Object.fromEntries(Object.entries(getEventListeners(t)).map(([k,v])=>[k,v.length]))))',includeCommandLineAPI:true,returnByValue:true})).result.value);
  const before=await listeners();await cdp.send('HeapProfiler.collectGarbage');const beforeHeap=(await cdp.send('Runtime.getHeapUsage')).usedSize,from=fixture.calls.length;
  for(let i=0;i<25;i++){await p.evaluate(dest=>document.querySelector('nav [data-page="'+dest+'"]').click(),['overview','shopping','pantry','recipes','chat'][i%5]);await p.evaluate(()=>new Promise(requestAnimationFrame))}
  check('Window and viewport listeners do not accumulate after 25 navigations',JSON.stringify(await listeners())===JSON.stringify(before));
  await cdp.send('HeapProfiler.collectGarbage');result.metrics.heapBefore=beforeHeap;result.metrics.heapAfter=(await cdp.send('Runtime.getHeapUsage')).usedSize;
  result.metrics.navigationHistoryRequests=fixture.calls.slice(from).filter(c=>/conversation_(index|page)/.test(c.path)).length;
  check('Navigation avoids repeated history fetches (one scheduled poll allowed)',result.metrics.navigationHistoryRequests<=3);await cdp.detach();
 }
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>MorzsaCompanion.openThread('10000000-0000-4000-8000-000000000005'));await shot('cooking');
 await p.evaluate(()=>MorzsaCompanion.newChat());await p.locator('#companion-input').fill('Mit főzzek?');
 await p.evaluate(()=>{window.__mobileOriginalViewport=window.visualViewport;const vv=new EventTarget();Object.assign(vv,{height:460,width:390,offsetTop:40,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{value:vv,configurable:true});window.dispatchEvent(new Event('resize'));window.MorzsaViewport?.refresh()});await p.waitForTimeout(150);await shot('keyboard-simulation');
 if(mode!=='before'){
  check('Composer clears simulated keyboard',await p.locator('.companion-compose-wrap').evaluate(el=>{const r=el.getBoundingClientRect(),v=visualViewport;return r.bottom<=v.offsetTop+v.height&&r.top>=v.offsetTop}));
  check('Send remains reachable above keyboard',await p.locator('#companion-form button[type=submit]').evaluate(el=>el.getBoundingClientRect().bottom<=visualViewport.offsetTop+visualViewport.height));
  await p.evaluate(()=>{Object.defineProperty(window,'visualViewport',{value:window.__mobileOriginalViewport,configurable:true});window.dispatchEvent(new Event('resize'))});await p.waitForTimeout(150);
  check('Keyboard close restores nav and composer',await p.evaluate(()=>!document.documentElement.classList.contains('keyboard-open')&&document.querySelector('.app>nav').getBoundingClientRect().height>0));
 }

 check('No uncaught browser errors',result.errors.length===0);
 await ctx.close();
}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');await browser.close();await fixture.close();console.log(JSON.stringify({out,...result.metrics,checks:result.checks.length,errors:result.errors,overflow:result.sizes.filter(s=>s.overflow)}))}
