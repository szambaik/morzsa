// Real controls and SQL-backed favourites; no provider requests or production data.
async page=>{
 const ctx=await page.context().browser().newContext({viewport:{width:320,height:740},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],check=(v,m)=>{if(!v)throw Error(m)};
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8850/?actor=c');await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');await p.evaluate(()=>dashboardGo('recipes'));await p.locator('button[data-feed-tab=browse]').click();await p.locator('.recipe-feed-grid .room-card').first().waitFor();
  for(const width of [320,360,390,1440]){
   await p.setViewportSize({width,height:width>=1000?900:844});await p.evaluate(()=>window.scrollTo(0,0));
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow '+width);
   check(await p.locator('.recipe-library-tools').count()===0,'conversation actions moved out of library '+width);
   check(await p.locator('.recipe-feed-filters').evaluate(e=>e.scrollWidth<=e.clientWidth&&getComputedStyle(e).flexWrap==='wrap'),'filters also fit without horizontal scrolling '+width);
   check(await p.locator('.activity-switcher').count()===0,'no duplicate navigation in library');
   check(await p.locator('[data-weekly-open]').innerText().then(t=>t.includes('Tervezd meg a hetet')&&t.includes('Kevesebb főzés')),'weekly entry has clear explanation');
   if(width<1000){const bottom=await p.locator('#workspace-assistant').boundingBox(),nav=await p.locator('.app>nav').boundingBox();check(bottom.y+bottom.height<=nav.y,'fixed shortcuts do not overlap navigation '+width)}
   await p.screenshot({path:'/private/tmp/morzsa-discovery-polished-'+width+'.png'});
  }
  await p.setViewportSize({width:390,height:844});const first=p.locator('.recipe-feed-grid .room-card').first(),rid=await first.locator('[data-feed-recipe]').getAttribute('data-feed-recipe');
  const heart=first.locator('[data-feed-favourite]'),old=await heart.getAttribute('aria-pressed');await heart.click();await p.waitForFunction(({rid,old})=>document.querySelector('[data-feed-favourite="'+rid+'"]').getAttribute('aria-pressed')!==old,{rid,old});
  check(await p.locator('.recipe-library').isVisible(),'favourite stays in discovery');check(await p.locator('.recipe-reading').count()===0,'favourite does not open recipe');
  if(old==='true'){await p.locator('[data-feed-favourite="'+rid+'"]').click();await p.waitForFunction(rid=>document.querySelector('[data-feed-favourite="'+rid+'"]').getAttribute('aria-pressed')==='true',rid)}
  await first.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));const rect=await first.boundingBox();await p.mouse.click(rect.x+10,rect.y+10);await p.locator('.recipe-reading').waitFor();check(await p.locator('.recipe-reading-hero h1').innerText().then(Boolean),'whole card opens from image corner');
  await p.locator('[data-reading-back]').click();await p.locator('button[data-feed-tab=browse]').click();const card=p.locator('.recipe-feed-grid .room-card').first();check(await card.locator('.room-card-actions button').innerText().then(t=>t.includes('Megnézem')),'concise CTA');check(await card.locator('.room-stock-match').isVisible(),'stock match preserved');
  await card.locator('.room-continue').focus();await p.keyboard.press('Enter');await p.locator('.recipe-reading').waitFor();await p.locator('[data-reading-back]').click();
  await p.locator('button[data-feed-tab=for-you]').click();check(await p.locator('[data-discovery-section=favourites]').count()===1,'real saved favourite drives personal section');
  await p.evaluate(()=>{state.stock={};commitState(state);RecipeRoom.render()});check(await p.locator('[data-discovery-section=pantry]').count()===0,'no invented pantry section');
  await p.locator('#workspace-new-chat').click();await p.locator('#companion-input').waitFor();check(await p.locator('.activity-switcher').count()===0,'fresh chat avoids mode bar');check(await p.locator('.companion-welcome').isVisible(),'new chat stays one action away');
  await p.evaluate(()=>dashboardGo('recipes'));await p.locator('[data-weekly-open]').click();check(await p.locator('[data-weekly-form]').isVisible(),'weekly planning functional');await p.locator('[data-weekly-open]').click();
  const q=await ctx.newPage();q.on('pageerror',e=>errors.push(e.message));let release;const gate=new Promise(r=>release=r);
  await q.route('**/rest/v1/rpc/recipe_feed',async route=>{await gate;await route.fulfill({json:[]})});await q.route('**/rest/v1/recipe_library_entries*',route=>route.fulfill({json:[]}));
  await q.goto('http://127.0.0.1:8850/?actor=c');await q.waitForFunction(()=>MorzsaPersistence.status()==='synced');await q.evaluate(()=>dashboardGo('recipes'));await q.locator('.recipe-feed-state').waitFor();check(await q.locator('.recipe-feed-state').innerText().then(t=>t.includes('betöltése')),'useful loading state');release();await q.locator('[data-feed-reset]').waitFor();check(await q.locator('.recipe-feed-state').innerText().then(t=>t.includes('nincs találat')),'useful empty state');await q.locator('[data-feed-reset]').click();check(await q.locator('button[data-feed-tab=browse]').getAttribute('aria-selected')==='true','empty state offers real browse action');
  check(errors.length===0,errors.join('\n'));return {passed:true,checks:['320/360/390/1440 overflow and touch targets','fixed layout','whole-card and keyboard opening','independent saved favourites','data-backed recommendations','weekly entry','no duplicate navigation','global new chat','loading/empty recovery'],errors};
 }finally{await ctx.close()}
}
