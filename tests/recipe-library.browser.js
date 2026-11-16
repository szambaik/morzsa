// Real clicks in an isolated SQL fixture; recipe images and AI are mocked.
async page=>{
 const ctx=await page.context().browser().newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],check=(v,s)=>{if(!v)throw Error(s)};
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8842/?actor=c');await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
  await p.evaluate(async()=>{window.qaPanelRecipe=await MorzsaPersistence.ensureRecipe({title:'Hozzávalópanel teszt '+Date.now(),summary:'Hosszú recept a helyzetmegőrzés ellenőrzéséhez.',servings:4,minutes:40,ingredients:catalog.filter(i=>!nonFoodCategories.has(i.category)).slice(0,15).map(i=>({name:i.name,amount:'100 g'})),stepTitles:['Előkészítés','Összeállítás','Sütés'],steps:Array.from({length:3},(_,i)=>('Keverd össze a hozzávalókat óvatosan. Ellenőrizd az állagot. '+(i+1)+'. rész. ').repeat(10))});MorzsaCompanion.discuss(qaPanelRecipe)});
  await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');await p.locator('[data-begin-cooking]').click();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');await p.waitForTimeout(100);await p.locator('[data-cooking-view=full]').click();await p.locator('#cooking-step-1').evaluate(e=>e.scrollIntoView({block:"start",behavior:"instant"}));await p.waitForTimeout(100);
  check(await p.locator('.cooking-guide #cooking-ingredients').count()===0,'no ingredients take up the method');
  async function panelCheck(button){
   check(await button.isVisible(),'ingredients shortcut stays available');const before=await p.evaluate(()=>scrollY);check(before>100,'test scrolled into recipe');
   await button.click();await p.locator('#recipe-ingredients-panel[open]').waitFor();check(await p.locator('#recipe-ingredients-panel .recipe-ingredient-row').count()===15,'all ingredients in own panel');
   await p.locator('.ingredients-panel-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);check(await p.locator('.ingredients-panel-scroll').evaluate(e=>e.scrollTop>100),'panel scrolls independently');
   await p.locator('[data-ingredients-close]').click();await p.waitForFunction(()=>!document.getElementById('recipe-ingredients-panel').open);check(Math.abs(await p.evaluate(()=>scrollY)-before)<=1,'close restores exact recipe scroll');
   await button.click();await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('recipe-ingredients-panel').open);await p.waitForTimeout(30);check(Math.abs(await p.evaluate(()=>scrollY)-before)<=1,'Escape preserves scroll');
  }
  await panelCheck(p.locator('[data-reading-ingredients]'));
  await p.locator('[data-cooking-view=focus]').click();await p.locator('#cooking-step-0').evaluate(e=>e.scrollIntoView({block:"start",behavior:"instant"}));await p.waitForTimeout(50);await panelCheck(p.locator('[data-reading-ingredients]'));
  await p.evaluate(()=>RecipeRoom.open(qaPanelRecipe));await p.locator('.recipe-method>ol>li').nth(1).evaluate(e=>e.scrollIntoView({block:"start",behavior:"instant"}));await p.waitForTimeout(100);check(await p.locator('.recipe-reading-detail .recipe-ingredient-list').count()===0,'reading page leaves room for method');await panelCheck(p.locator('[data-workspace-ingredients]'));
  await p.locator('[data-workspace-ingredients]').click();await p.locator('#recipe-ingredients-panel [data-recipe-list]').first().click();check(await p.evaluate(()=>state.cart.some(i=>i.recipeNeeds?.some(n=>n.recipe.title===qaPanelRecipe.title))),'ingredient list action works in panel');await p.locator('[data-ingredients-close]').click();
  await p.locator('[data-reading-back]').click();await p.locator('[data-feed-tab=mine]').click();check(await p.locator('.recipe-feed-tabs button').allTextContents().then(a=>a.join('|')==='Neked|Böngészés|Mentettek'),'three simple tabs');
  check(await p.locator('.recipe-resume-row').count()>=1,'active cooking separate from saved cards');check(await p.locator('.recipe-library .room-card [data-recipe-export]').count()===0,'no export buttons on cards');
  await p.locator('[data-feed-tab=browse]').click();await p.locator('.recipe-feed-grid .room-card').first().waitFor();check(await p.locator('.recipe-feed-grid .room-card').first().locator('.room-card-actions button').count()===1,'single primary card action');check(await p.locator('.recipe-feed-grid .room-card').first().locator('.room-summary,.recipe-choice-details').count()===0,'quiet card content');
  for(const width of [320,390,430,1440]){
   await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no library overflow '+width);
   check(await p.locator('.recipe-feed-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)===(width>=1000?2:1),'responsive columns '+width);
   if(width===390||width===1440)await p.screenshot({path:'/private/tmp/morzsa-recipe-library-'+width+'.png',fullPage:true});
  }
  await p.setViewportSize({width:320,height:740});await p.evaluate(()=>RecipeRoom.open(qaPanelRecipe));await p.locator('[data-workspace-ingredients]').click();check(await p.locator('#recipe-ingredients-panel').evaluate(e=>e.getBoundingClientRect().width<=innerWidth),'panel fits narrow phone');await p.screenshot({path:'/private/tmp/morzsa-ingredients-panel-320.png'});await p.locator('[data-ingredients-close]').click();
  check(errors.length===0,errors.join('\n'));return {passed:true,checks:['full/focus/reading scroll preserved','independent ingredient scrolling','Escape close','live shopping actions','active sessions separate','simple cards','320/390/430/1440'],errors};
 }finally{await ctx.close()}
}
