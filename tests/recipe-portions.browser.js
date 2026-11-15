// Uses a local SQL fixture and mocked image provider; no paid calls or real household edits.
async page=>{
 const browser=page.context().browser(),context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await context.newPage(),errors=[],check=(ok,msg)=>{if(!ok)throw Error(msg)};let second;
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8840/?actor=c');await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
  await p.evaluate(async()=>{window.qaApple=await MorzsaPersistence.ensureRecipe({title:'Adagpróba: almás sütemény',summary:'Fahéjas almás sütemény kis sütőformában, két főre.',minutes:55,ingredients:[{name:'Alma',amount:'2 közepes db'},{name:'Liszt',amount:'100 g'},{name:'Vaj',amount:'50 g'},{name:'Cukor',amount:'30 g'},{name:'Tojás',amount:'1 db'},{name:'Sütőpor',amount:'fél teáskanál'}],stepTitles:['Forma előkészítése','Alma előkészítése','Tészta összeállítása','Sütés és ellenőrzés'],steps:['Melegítsd elő a sütőt 180 °C-ra. Egy kis formát vajazz ki.','Az almát hámozd meg és reszeld le. Ha nagyon nedves, nyomkodd ki a felesleges levet.','Keverd össze a vajat a cukorral, majd add hozzá a tojást. Dolgozd bele a lisztet és a sütőport. A tészta legyen sima és lágy.','Simítsd a tésztát a formába, majd oszlasd el rajta az almát. Süsd 30–35 percig. Ellenőrizd a tésztát tűpróbával.']});AIMode.set('plus');RecipeRoom.open(qaApple)});
  check(await p.locator('[data-portions-target]').inputValue()==='2','legacy servings from explicit description');
  await p.locator('[data-portions-delta="1"]').click();await p.locator('[data-portions-delta="1"]').click();
  check(await p.locator('.recipe-needed').nth(1).innerText()==='200 g','reading ingredients scaled');check(await p.locator('.recipe-needed').first().innerText()==='4 közepes db','descriptive piece units scaled');
  check(await p.locator('.recipe-method li p').first().innerText().then(s=>s.includes('180 °C')),'temperature unchanged');
  await p.locator('[data-recipe-list="0"]').click();check(await p.evaluate(()=>state.cart.find(i=>i.name==='Alma')?.quantity===4),'scaled apples reach list');
  for(let i=0;i<4;i++){await p.locator('.recipe-method li').nth(i).evaluate(el=>el.scrollIntoView({block:'center'}));await p.locator('.recipe-method li').nth(i).locator('.generated-recipe-image img').waitFor({state:'attached'})}
  const calls=()=>p.evaluate(async()=> (await (await fetch('/qa/status')).json()).calls.filter(c=>c.recipeId===qaApple.recipeId&&c.create).length),before=await calls();
  const image=await p.locator('.recipe-method li').first().locator('.generated-recipe-image img').boundingBox();check(image.width<=280&&image.height<=180,'step illustration is compact');
  await p.locator('[data-start-cooking]').click();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
  check(await p.locator('.cooking-hero [data-portions-target]').inputValue()==='4','reading portions carry into cooking');
  await p.locator('[data-current-recipe]').click();check(await p.locator('.recipe-needed').nth(1).innerText()==='200 g','cooking ingredient panel scaled');check(await p.locator('#cooking-ingredients h3').count()===0,'no duplicate ingredients heading');
  await p.locator('[data-portions-delta="1"]').click();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');check(await p.locator('.recipe-needed').nth(1).innerText()==='250 g','changing cooking portions updates ingredients');
  check(await calls()===before,'portion changes never regenerate existing images');
  const cid=await p.evaluate(()=>MorzsaCompanion.recipeThreads().find(t=>t.recipe.title===qaApple.title).id);
  const meta=await p.evaluate(async id=>(await household.dataRpc('conversation_index',{},true)).find(t=>t.id===id).metadata,cid);check(meta.portions.target===5,'portion choice persisted to backend');check(!meta.recipe.servings&&meta.recipe.ingredients[1].amount==='100 g','canonical historical recipe preserved');
  second=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const other=await second.newPage();await other.goto('http://127.0.0.1:8840/?actor=c');await other.waitForFunction(()=>MorzsaPersistence.status()==='synced');await other.evaluate(id=>MorzsaCompanion.openThread(id),cid);check(await other.locator('.cooking-hero [data-portions-target]').inputValue()==='5','same portions on another device');
  for(const width of [320,430,1440]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'layout fits at '+width)}
  await p.setViewportSize({width:390,height:844});await p.locator('[data-cooking-view="full"]').click();await p.locator('#cooking-step-1').evaluate(el=>el.scrollIntoView({block:'center'}));await p.screenshot({path:'/private/tmp/morzsa-portions-mobile.png'});
  check(!errors.length,errors.join('\n'));return {passed:true,checks:['explicit legacy serving recovery','scaled ingredients and descriptive units','shopping counts','compact illustrations','reading to cooking','canonical recipe and images unchanged','cross-device portions','320/430/1440 layout'],errors};
 }finally{await second?.close();await context.close()}
}
