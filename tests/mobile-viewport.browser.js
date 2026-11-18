async page=>{
 const checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)},base=process.env.MORZSA_QA_BASE||'http://127.0.0.1:8942';
 await page.goto(base+'/?actor=c');await page.waitForFunction(()=>MorzsaPersistence.status()==='synced'&&!household.busy);
 await page.evaluate(()=>MorzsaCompanion.newChat());
 const send=page.locator('#companion-form [type=submit]'),input=page.locator('#companion-input');
 check(await send.isDisabled(),'empty web draft disables Send');
 await input.fill('   ');await input.press('Enter');
 check(await send.isDisabled()&&await page.locator('.companion-message.user').count()===0,'whitespace and Enter do not submit a blank message');
 await input.fill('a');
 check(await send.isEnabled(),'first web character enables Send');
 check(await send.evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(191, 78, 44)'),'web Send uses the Morzsa orange');
 await input.fill('');
 check(await send.isDisabled(),'deleting the web draft disables Send again');
 await page.addStyleTag({url:base+'/mobile/ios.css'});
 await page.evaluate(async()=>{
  document.documentElement.classList.add('native-app','native-ios');
  const {installIOSControls}=await import('/mobile/ios-controls.js');window.viewportControls=[];
  window.viewportNative=installIOSControls({setControls:async value=>{viewportControls.push(value);return {revision:value.revision}}});
  Object.assign(state.stock,{Tej:2,'Tojás':2,Alma:2});
 });
 const tick=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const nav=async dest=>{await page.evaluate(d=>document.querySelector('nav [data-page="'+d+'"]').click(),dest);await tick()};
 for(const width of [320,360,390,430,1366]){
  await page.setViewportSize({width,height:844});await nav('pantry');
  check(await page.locator('.pantry-inline-search button,.pantry-quick-setup').count()===0,'pantry addition no longer occupies the content at '+width);
  check(await page.locator('#catalog-search').isVisible(),'pantry search remains at '+width);
  for(const dest of ['pantry','shopping']){
   await nav(dest);await page.locator('#workspace-quick-add.ios-native-control').waitFor({state:'attached'});
   const geometry=await page.locator('#workspace-quick-add').evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.right<=innerWidth&&r.right>=innerWidth-45&&r.bottom<=innerHeight&&r.top>innerHeight*.65});
   check(geometry,dest+' floating plus fits at '+width);
   check(await page.locator('#main #add-cart').count()===0,'no old shopping editor at '+width);
   if(dest==='shopping')check(await page.evaluate(()=>{const a=document.getElementById('workspace-quick-add').getBoundingClientRect(),b=document.querySelector('[data-start-shopping]').getBoundingClientRect();return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom}),'shopping switch and plus do not overlap at '+width);
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow on '+dest+' '+width);
  }
  if(width<1000)for(const dest of ['chat','pantry','shopping','recipes']){
   await nav(dest);
   if(dest==='chat')check(await page.locator('.companion-starters').evaluate(el=>el.getBoundingClientRect().top-document.querySelector('.app>header').getBoundingClientRect().bottom<100),'compact space above chat starters '+width);
   check(await page.locator('.app>header .brand').evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.left+r.width/2-innerWidth/2)<1}),'centered mobile wordmark '+dest+' '+width);
   check(await page.locator('.app>header .brand').evaluate(el=>{const r=el.getBoundingClientRect();return [...el.parentElement.querySelectorAll('button')].filter(b=>!b.hidden&&b.getBoundingClientRect().width).every(b=>{const a=b.getBoundingClientRect();return a.right<=r.left||a.left>=r.right})}),'header controls clear the wordmark '+dest+' '+width);
  }
 }
 await page.setViewportSize({width:390,height:844});await nav('pantry');
 // Dispatch the same callback as the native Liquid Glass button.
 await page.evaluate(()=>{const payload=viewportControls.at(-1),button=payload.buttons.find(b=>b.label==='Hozzáadás a készlethez');window.dispatchEvent(new CustomEvent('morzsa-native-action',{detail:{...button,revision:payload.revision}}))});
 const sheet=page.locator('#workspace-entry');await sheet.waitFor({state:'visible'});
 check(await sheet.locator('[data-entry-target=stock]').getAttribute('aria-pressed')==='true','pantry plus opens the pantry destination');
 check(await sheet.locator('[data-pantry-setup]').isVisible(),'dictation and packs live in the pantry add sheet');
 check(await sheet.locator('input').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),'quick entry does not use focus-zoom font size');
 await sheet.locator('input').fill('Új tesztfűszer');await sheet.locator('input').press('Enter');await sheet.locator('.workspace-entry-save').click();
 await page.waitForFunction(()=>state.stock['Új tesztfűszer']===2);check(true,'pantry save still works');
 await nav('shopping');await page.evaluate(()=>document.getElementById('workspace-quick-add').click());
 check(await sheet.locator('[data-entry-target=cart]').getAttribute('aria-pressed')==='true','list plus opens the shopping destination');
 check(await sheet.locator('[data-pantry-setup]').isHidden(),'pantry setup does not compete in shopping entry');
 await sheet.locator('input').fill('Kenyér, Vaj');await sheet.locator('input').press('Enter');await sheet.locator('.workspace-entry-save').click();
 await page.waitForFunction(()=>state.cart.some(i=>i.name==='Kenyér')&&state.cart.some(i=>i.name==='Vaj'));check(true,'shopping batch save still works');
 await page.locator('[data-start-shopping]').click();await tick();
 check(await page.locator('#workspace-quick-add').isHidden(),'planning plus stays out of in-store mode');
 check(await page.locator('[data-toggle-shopping-add]').isVisible(),'in-store purchase addition remains available');
 await page.locator('[data-exit-shopping]').click();await nav('chat');
 for(const [width,height] of [[320,568],[360,740],[390,844],[430,932],[390,400],[430,320]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>document.querySelector('.companion-header-history').click());
  const history=page.locator('#companion-history');await history.waitFor({state:'visible'});await history.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));await tick();
  await history.evaluate(el=>{const list=el.querySelector('.companion-history-items'),row=list.querySelector('.history-thread');if(row)for(let i=0;i<35;i++)list.append(row.cloneNode(true))});
  check(await history.evaluate(el=>{const r=el.getBoundingClientRect(),v=visualViewport;return r.width<=v.width&&r.height<=v.height+1&&r.top>=v.offsetTop-1&&r.bottom<=v.offsetTop+v.height+1&&el.scrollWidth<=el.clientWidth}),'drawer fits visual viewport '+width+'x'+height);
  if(await history.locator('[data-history-search]').isHidden())await history.locator('[data-history-toggle-search]').click();await history.locator('[data-history-search]').fill('tej');
  check(await history.locator('[data-history-search]').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),'history search avoids iOS focus zoom '+height);
  check(await history.locator('[data-new-chat]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1}),'drawer footer reachable '+width+'x'+height);
  if(height<500){
   await history.locator('.history-options>summary').click();await history.locator('.workspace-settings>summary').click();
   check(await history.locator('[data-new-chat]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=visualViewport.offsetTop+visualViewport.height+1}),'expanded drawer controls stay within short viewport '+height);
   await history.locator('.workspace-settings>summary').click();await history.locator('.history-options>summary').click();
  }
  check(await page.evaluate(()=>visualViewport.scale===1),'viewport remains at normal scale '+height);
  await page.evaluate(()=>document.getElementById('companion-history').close());await tick();
  check(await page.evaluate(()=>getComputedStyle(document.body).overflow!=='hidden'),'background scrolling restored '+height);
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>viewportNative.dispose());
 const out=process.env.MORZSA_VIEWPORT_OUT;
 if(out){
  for(const dest of ['pantry','shopping']){await nav(dest);await page.screenshot({path:out+'/'+dest+'-390.png'})}
  await page.locator('#workspace-quick-add').click();await page.screenshot({path:out+'/add-sheet-390.png'});await page.locator('[data-entry-close]').click();
  await nav('chat');await page.locator('.companion-header-history').click();
  const history=page.locator('#companion-history');await history.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
  await history.locator('[data-history-search]').fill('');await history.locator('[data-history-toggle-search]').click();
  await page.screenshot({path:out+'/history-390.png'});
  await page.setViewportSize({width:430,height:320});await history.locator('[data-history-toggle-search]').click();await history.locator('[data-history-search]').fill('tej');await tick();
  await page.screenshot({path:out+'/history-short.png'});await page.keyboard.press('Escape');
 }

 return {passed:true,count:checks.length,checks};
}
