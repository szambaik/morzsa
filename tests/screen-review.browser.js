// Run against MORZSA_QA_PORT=8836 node tests/persistence-fixture.mjs.
async(page)=>{
 const context=await page.context().browser().newContext({viewport:{width:390,height:844}}),p=await context.newPage(),errors=[],check=(ok,msg)=>{if(!ok)throw Error(msg)};
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8836/?actor=c');await p.waitForFunction(()=>window.RecipeRoom?.choiceMarkup&&MorzsaPersistence.status()==='synced');
  await p.evaluate(()=>{household.active=null;state={...state,stock:{Tej:0,Tojás:1,Liszt:2},cart:[{name:'Tej',quantity:1,unit:'l',done:false},{name:'Tojás',quantity:6,unit:'db',done:false},{name:'Alma',quantity:1,unit:'kg',done:true}],history:[]};dashboardGo('shopping')});
  check(await p.locator('#shopping-pending').innerText()==='2 hátravan','remaining count is explicit');
  check(await p.locator('.shopping-group').count()===1,'purchased-only categories are outside remaining list');
  check(!await p.locator('.shopping-normal-purchased').evaluate(el=>el.open),'purchased section starts collapsed');
  const hit=await p.locator('.shopping-mode-check').first().boundingBox();check(hit.width>=44&&hit.height>=44,'small visual check retains accessible hit target');
  await p.locator('.shopping-group summary').click();check(!await p.locator('.shopping-group').evaluate(el=>el.open),'category collapses');await p.locator('.shopping-group summary').click();
  await p.locator('[data-cart="0"]').click();await p.locator('#shopping-action-feedback button').click();check(await p.evaluate(()=>!state.cart.find(i=>i.name==='Tej').done),'checking has functional undo');
  await p.locator('[data-start-shopping]').click();check(await p.locator('.shopping-mode-dock').evaluate(el=>el.getBoundingClientRect().height)<90,'shopping dock is compact');
  check(!await p.locator('#shopping-mode-add').isVisible(),'add field is collapsed');await p.locator('[data-toggle-shopping-add]').click();await p.locator('#shopping-mode-add input').fill('Banán');await p.locator('#shopping-mode-add button').click();
  check(await p.evaluate(()=>state.cart.find(i=>i.name==='Banán')?.done),'new purchase is checked and categorised');
  await p.locator('[data-exit-shopping]').click();check(await p.locator('[data-start-shopping]').innerText()==='Vásárlás folytatása','session can resume with one call to action');check(!await p.locator('.shopping-start-actions').innerText().then(t=>t.includes('Folyamatban')),'no duplicate session labels');
  await p.locator('[data-start-shopping]').click();await p.locator('[data-finish-shopping]').click();check((await p.locator('#finish-shopping-dialog').innerText()).includes('hátravan'),'completion gives a purchase summary');await p.locator('#finish-cancel').click();await p.locator('[data-exit-shopping]').click();
  await p.evaluate(()=>{state.stock={Tej:0,Tojás:1,Liszt:2};state.cart=[];dashboardGo('overview')});check((await p.locator('.daily-counts').innerText()).includes('Pótlandó'),'dashboard prioritises replenishment');
  await p.locator('[data-dashboard-refill="Tej"]').click();check(await p.evaluate(()=>state.cart.find(i=>i.name==='Tej')?.quantity===1),'dashboard adds one item');check(await p.locator('[data-dashboard-refill="Tej"]').count()===0,'already-listed items are not added twice');
  check(!await p.locator('#workspace-assistant').isVisible(),'overview has no bottom composer or duplicate actions');check(await p.locator('.kitchen-activity').count()===0,'no empty activity area');
  await p.locator('nav [data-page=recipes]').click();await p.locator('.recipe-choice').first().waitFor();await p.locator('.recipe-choice-details summary').first().click();check((await p.locator('.recipe-choice-details').first().innerText()).includes('Ellenőrizd'),'recipe choices distinguish unknown availability');
  await p.evaluate(()=>MorzsaOnboarding.open());check(await p.locator('[data-intro-start]').count()===4,'intro offers four real starting paths');await p.locator('[data-intro-start=shopping]').click();check(await p.locator('#workspace-entry input').evaluate(el=>document.activeElement===el),'list onboarding opens focused entry');
  await p.evaluate(()=>MorzsaOnboarding.open());await p.locator('[data-intro-language=en]').click();check((await p.locator('[data-intro-start=stock]').innerText()).includes('Show what'),'intro can select English');await p.locator('[data-intro-start=stock]').click();await p.locator('#workspace-entry').waitFor();await p.locator('[data-entry-close]').click();
  await p.evaluate(()=>{state.cart=[];household.voiceCommandStream=async()=>({answer:'Felírhatom a rizst.',transcript:'Írd fel a rizst',clarification:'',recipes:[],operations:[{action:'list_set',name:'Rizs',quantity:null,unit:null}]});MorzsaCompanion.newChat()});
  await p.locator('#companion-input').fill('Írd fel a rizst');await p.locator('#companion-form [type=submit]').click();await p.locator('.companion-proposal').waitFor();
  check(!await p.evaluate(()=>state.cart.some(i=>i.name==='Rizs')),'proposal has no effect before approval');check(await p.locator('.companion-messages .companion-proposal').count()===0,'household actions are outside the dialogue');
  await p.locator('[data-companion-apply]').click();await p.locator('.companion-proposal').waitFor({state:'hidden'});check(await p.evaluate(()=>state.cart.some(i=>i.name==='Rizs')),'approved action saves through existing pipeline');
  for(const width of [320,430,1440]){await p.setViewportSize({width,height:900});for(const target of ['overview','shopping','recipes']){await p.locator('nav [data-page='+target+']').click();check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),target+' fits at '+width)}}
  check(!errors.length,errors.join('\n'));return {passed:true,checks:['compact checks with 44px targets','purchased separation and undo','compact shopping dock','add purchase and resume','finish summary','actionable dashboard','recipe decision support','four onboarding paths and language','320/430/1440 layout'],errors};
 }finally{await context.close()}
}
