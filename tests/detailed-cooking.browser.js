// Run against MORZSA_QA_PORT=8838 node tests/persistence-fixture.mjs; providers are mocked.
async page=>{
 const context=await page.context().browser().newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await context.newPage(),errors=[],check=(ok,message)=>{if(!ok)throw Error(message)};
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8838/?actor=c');await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
  await p.evaluate(async()=>{window.qaRecipe=await MorzsaPersistence.ensureRecipe({title:'Mérleg nélküli palacsinta',summary:'Egyszerű palacsinta a konyhádból.',minutes:25,ingredients:[{name:'Liszt',amount:'130 g'},{name:'Tej',amount:'250 ml'},{name:'Tojás',amount:'1 db'}],stepTitles:['Keverd simára a tésztát','Pihentesd a keveréket','Süsd vékonyra a palacsintát'],steps:['Szórd a lisztet egy közepes tálba, és a közepébe üsd a tojást. Apránként öntsd hozzá a tejet, közben habverővel keverd, hogy ne maradjanak csomók. A tésztának híg tejszínhez hasonlóan kell lefolynia a kanálról. Ha sűrű, evőkanalanként adj hozzá egy kis vizet. Ne keverd erősen hosszú percekig: elég, amíg sima lesz. '.repeat(2).trim(),'Hagyd állni a tésztát körülbelül tíz percig. Ezalatt a liszt felveszi a folyadékot. Sütés előtt keverd át, és ellenőrizd, hogy még könnyen önthető-e. Ha besűrűsödött, kevés vizet keverj bele.','Melegítsd fel a serpenyőt közepes lángon, és vékonyan kend ki olajjal. Önts bele egy kis merőkanál tésztát, majd döntsd körbe. Amikor a széle elválik és alul aranybarna, óvatosan fordítsd meg. A másik oldalnak rövidebb idő kell. Ha túl gyorsan barnul, csökkentsd a hőt.']});AIMode.set('plus');RecipeRoom.open(qaRecipe)});
  await p.locator('.recipe-measures-toggle').click();check(await p.locator('.recipe-measure-hint').count()===2,'known masses and volumes have useful hints');
  check(await p.locator('.recipe-measure-hint').first().innerText()==='Kb. 1 bögre · lazán töltve, lesimítva','loose flour guide');
  check(await p.locator('.recipe-needed').first().innerText()==='130 g','shopping amount is unchanged');
  check((await p.locator('.recipe-method li p').first().innerText()).length>500,'long steps display without truncation');
  for(let i=0;i<3;i++){await p.locator('.recipe-method li').nth(i).scrollIntoViewIfNeeded();await p.locator('.recipe-method li').nth(i).locator('img').waitFor();}
  const getCalls=()=>p.evaluate(async()=> (await (await fetch('/qa/status')).json()).calls.filter(c=>c.recipeId===qaRecipe.recipeId));
  let calls=await getCalls();check([0,1,2].every(step=>calls.some(c=>c.step===step&&c.create&&c.quality==='plus')),'Plus creates every viewed step by default');
  const before=calls.filter(c=>c.create).length;
  await p.locator('[data-start-cooking]').click();await p.locator('.cooking-guide').waitFor();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
  await p.locator('[data-current-recipe]').click();check(await p.locator('.recipe-measures-note').isVisible(),'measurement preference carries into cooking');
  await p.locator('[data-cooking-view="focus"]').click();check(await p.locator('.cooking-step:visible').count()===1,'focus displays only selected step');
  await p.locator('[data-step-next]').click();await p.locator('#cooking-step-1 [data-cooking-image] img').waitFor({state:'attached'});
  calls=await getCalls();check(calls.filter(c=>c.create).length===before,'cooking reuses cached reading images');
  for(const width of [320,430,1440]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow at '+width)}
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/private/tmp/morzsa-detailed-cooking.png',fullPage:true});
  await p.evaluate(async()=>{window.qaFreeRecipe=await MorzsaPersistence.ensureRecipe({...qaRecipe,recipeId:undefined,title:'Free mérleg nélküli próba',steps:['Mérd ki a lisztet.','Várj tíz percet.'],stepTitles:['Mérd ki a lisztet','Pihentesd a tésztát']});AIMode.set('free');RecipeRoom.open(qaFreeRecipe)});
  for(let i=0;i<2;i++){await p.evaluate(index=>document.querySelectorAll('.recipe-method li')[index].scrollIntoView({block:'center'}),i);await p.waitForFunction(index=>document.querySelectorAll('.recipe-method .generated-recipe-image')[index]?.dataset.imageStatus==='missing',i)}
  check(await p.evaluate(async()=>!(await (await fetch('/qa/status')).json()).calls.some(c=>c.recipeId===qaFreeRecipe.recipeId&&c.step>=0&&c.create)),'Free retains selective step generation');
  check(!errors.length,errors.join('\n'));return {passed:true,checks:['long steps saved and rendered','practical measures leave exact shopping amounts intact','Plus images for all viewed steps','cache reused in cooking','measurement preference','focus navigation','320/430/1440 layout'],errors};
 }finally{await context.close()}
}
