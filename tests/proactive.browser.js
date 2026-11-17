// Run against MORZSA_QA_PROACTIVE=1 MORZSA_QA_PORT=8898 node tests/persistence-fixture.mjs.
async page=>{
 const browser=page.context().browser(),checks=[],errors=[],contexts=[],base='http://127.0.0.1:8898';
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
 const open=async(actor,width=390)=>{const c=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/?actor='+actor);await p.waitForFunction(()=>!!window.MorzsaProactive&&!!household.userId());if(actor!=='c')await p.waitForFunction(()=>!!household.active);return p};
 const nav=async(p,name)=>{await p.locator('nav [data-page="'+name+'"]').click();await p.waitForFunction(name=>document.querySelector('.app').dataset.page===name,name)};
 try{
  const p=await open('c');
  await p.evaluate(async()=>{commitState({...state,stock:{Tej:1,Vaj:0,Tojás:2,Liszt:2,Só:2,Olaj:2},cart:[]});await PantryReview.refresh();dashboardGo('overview')});
  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:844});await p.waitForTimeout(80);
   check(JSON.stringify(await p.locator('nav [data-page]').evaluateAll(bs=>bs.map(b=>b.dataset.page)))===JSON.stringify(['overview','shopping','chat','pantry','recipes']),'navigation order '+width);
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overview width '+width);
   check(await p.locator('.proactive-overview [data-proactive-card]').count()<=3,'at most three highlights '+width);
   for(const b of await p.locator('nav [data-page]').all()){const box=await b.boundingBox();check(box.width>=44&&box.height>=44,'navigation touch target '+width)}
   for(const destination of ['shopping','chat','pantry','recipes','overview']){await nav(p,destination);check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),destination+' fits '+width);check(await p.locator('nav [data-page]').count()===5,'all destinations accessible from '+destination+' '+width)}
  }
  await p.setViewportSize({width:390,height:844});
  check(await p.locator('.proactive-overview').innerText().then(t=>t.includes('Érdemes ránézni')&&t.includes('Morzsa ajánlja')),'overview surfaces present');
  await p.locator('[data-proactive-card="product:tej"] summary').click();await p.locator('[data-proactive-card="product:tej"] [data-proactive-action="later"]').click();
  await p.waitForFunction(()=>!MorzsaProactive.products().some(s=>s.name==='Tej'));check(await p.evaluate(()=>state.stock.Tej===1&&state.cart.length===0),'snooze does not mutate pantry or list');
  await nav(p,'shopping');check(await p.locator('[data-proactive-card="product:tej"]').count()===0,'snooze shared across surfaces');
  check(await p.locator('[data-proactive-approve]').isDisabled(),'nothing preselected');
  await p.locator('[data-proactive-select="product:vaj"]').check();check(await p.locator('[data-proactive-select="product:vaj"]').evaluate(el=>el===document.activeElement),'selection retains keyboard focus');check(await p.evaluate(()=>state.cart.length===0),'selection is only a preview');
  await p.locator('[data-proactive-approve]').click();await p.waitForFunction(()=>state.cart.some(i=>i.name==='Vaj'));
  check(await p.evaluate(()=>state.stock.Vaj===0&&state.cart.filter(i=>i.name==='Vaj').length===1),'approval adds exactly once without stock mutation');
  await p.reload();await p.waitForFunction(()=>!!window.MorzsaProactive);check(await p.evaluate(()=>!MorzsaProactive.products().some(s=>s.name==='Tej')),'cooldown survives reload');
  await p.evaluate(()=>MorzsaCompanion.newChat());const draft='Ezt a kérdést később küldöm.';await p.locator('#companion-input').fill(draft);const before=await p.evaluate(()=>document.querySelector('.companion-heading').textContent);
  await nav(p,'pantry');await nav(p,'chat');check(await p.locator('#companion-input').inputValue()===draft,'chat draft survives tab switch');check(await p.evaluate(()=>document.querySelector('.companion-heading').textContent)===before,'active conversation survives tab switch');
  await nav(p,'overview');await p.evaluate(()=>scrollTo(0,350));const y=await p.evaluate(()=>scrollY);await nav(p,'shopping');await nav(p,'overview');await p.waitForTimeout(80);check(Math.abs(await p.evaluate(()=>scrollY)-y)<4,'overview scroll survives tab switch');
  await nav(p,'recipes');await p.waitForSelector('.proactive-recommendations');
  check(await p.evaluate(()=>{const featured=[...document.querySelectorAll('.proactive-recommendations [data-proactive-recipe]')].map(b=>b.dataset.proactiveRecipe);return [...document.querySelectorAll('.recipe-discovery-section .room-card:not([hidden]) [data-feed-recipe]')].every(b=>!featured.includes(b.dataset.feedRecipe))}),'featured recipes are not duplicated below');
  await p.locator('.proactive-recommendations [data-proactive-recipe]').first().click();await p.waitForSelector('.recipe-reading');check(await p.locator('.recipe-reading-detail').innerText().then(t=>t.length>100)&&await p.locator('[data-start-cooking]').count()===1,'recommendation opens a real recipe');
  await nav(p,'shopping');await nav(p,'recipes');check(await p.locator('.recipe-reading').count()===1,'recipe reading context survives tab switch');
  await p.evaluate(()=>{language='en';render()});await nav(p,'overview');check(await p.locator('.proactive-overview').innerText().then(t=>t.includes('Morzsa recommends')||t.includes('Worth a look')),'English proactive text');
  check(await p.evaluate(()=>qaChatRequests.length===0),'no automatic AI conversation requests');
  const a=await open('a'),b=await open('b');
  await a.evaluate(async()=>{await saveVoiceState({...state,stock:{...state.stock,Tej:1,Vaj:0},cart:[]});await MorzsaProactive.refresh(true);dashboardGo('overview')});
  await a.waitForSelector('[data-proactive-card="product:tej"]');
  await a.locator('[data-proactive-card="product:tej"] summary').click();await a.locator('[data-proactive-card="product:tej"] [data-proactive-action="later"]').click();await a.waitForFunction(()=>!MorzsaProactive.products().some(s=>s.name==='Tej'));
  await b.evaluate(async()=>{await MorzsaProactive.refresh(true);dashboardGo('overview')});check(await b.locator('[data-proactive-card="product:tej"]').count()===0,'A snooze is respected for B');
  await b.locator('[data-proactive-card="product:vaj"] [data-proactive-action="accepted"]').click();await b.waitForFunction(()=>state.cart.some(i=>i.name==='Vaj'));
  check(await b.evaluate(()=>!household.busy&&state.cart.filter(i=>i.name==='Vaj').length===1),'shared action confirmed and lock released');
  await a.evaluate(async()=>{await MorzsaProactive.refresh(true);dashboardGo('overview')});check(await a.locator('[data-proactive-card="product:vaj"]').count()===0,'B approval removes suggestion for A');
  await p.evaluate(()=>{language='hu';commitState({...state,stock:{Tej:1,Vaj:0,Tojás:2,Liszt:2,Só:2,Olaj:2},cart:[]});localStorage.removeItem('morzsa-proactive-v1:'+JSON.stringify([household.userId(),'local']))});await p.reload();await p.waitForFunction(()=>!!window.MorzsaProactive);await nav(p,'overview');
  for(const width of [320,390,1440]){await p.setViewportSize({width,height:844});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'/tmp/morzsa-proactive-review/overview-'+width+'.png',fullPage:true})}
  await p.setViewportSize({width:390,height:844});await nav(p,'chat');await p.evaluate(()=>MorzsaCompanion.newChat());await p.screenshot({path:'/tmp/morzsa-proactive-review/chat-390.png',fullPage:true});await nav(p,'shopping');await p.screenshot({path:'/tmp/morzsa-proactive-review/shopping-390.png',fullPage:true});
  check(errors.length===0,'no browser runtime errors: '+errors.join(', '));return {passed:true,count:checks.length,checks};
 }catch(e){throw Error(e.message+'; last passed: '+checks.at(-1)+'; runtime errors: '+errors.join(', '))}finally{for(const c of contexts)await c.close()}
}
