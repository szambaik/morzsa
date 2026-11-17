async page=>{
 const checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
 await page.goto('http://127.0.0.1:8899/?actor=c');await page.waitForFunction(()=>!!window.MorzsaCompanion&&!!window.MorzsaWorkspace);
 await page.evaluate(async()=>{
  const {installIOSControls}=await import('/mobile/ios-controls.js');document.documentElement.classList.add('native-app');
  window.glassCalls=[];window.glassMode='defer';window.native=installIOSControls({setControls:value=>{glassCalls.push(value);return glassMode==='reject'?Promise.reject(Error('bridge offline')):glassMode==='defer'?new Promise(resolve=>window.glassResolve=()=>resolve({revision:value.revision})):Promise.resolve({revision:value.revision})}});
 });
 const tick=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await tick();
 check(await page.locator('.ios-native-control').count()===0,'web buttons stay usable before native acknowledgment');
 await page.evaluate(()=>{glassMode='normal';glassResolve()});await tick();
 check(await page.locator('.ios-native-control').count()>0,'acknowledged native buttons replace simple web buttons');
 check(await page.evaluate(()=>{const b=glassCalls.at(-1).buttons.find(b=>b.symbol==='sidebar.left');return !b||b.title===''}),'native history icon does not duplicate the web hamburger glyph');
 check(await page.locator('.ios-native-control').evaluateAll(els=>els.every(el=>el.getAttribute('aria-hidden')==='true'&&el.tabIndex===-1)),'native controls have no duplicate accessibility targets');
 check(await page.locator('#companion-form [data-photo]').evaluate(el=>!el.classList.contains('ios-native-control')),'photo picker retains trusted user activation');
 await page.evaluate(()=>{window.oldCalls=glassCalls.length;for(let i=0;i<10;i++)native.refresh()});await tick();check(await page.evaluate(()=>glassCalls.length===oldCalls),'unchanged state sends no repeated control payloads');
 for(const width of [320,360,390,1366]){
  await page.setViewportSize({width,height:844});await tick();
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow at '+width);
  check(await page.locator('#workspace-kitchen').count()===0,'no duplicate header household at '+width);
  check(await page.evaluate(()=>{const a=document.getElementById('workspace-new-chat').getBoundingClientRect(),b=document.querySelector('#companion-form button[type=submit]').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<2&&a.bottom<b.top}),'new chat floats above Send at '+width);
 }
 await page.setViewportSize({width:390,height:844});await tick();
 // Dispatch a real native callback. The existing web handler must create a chat.
 await page.evaluate(()=>{window.newChatCalls=0;window.originalNewChat=MorzsaCompanion.newChat;MorzsaCompanion.newChat=(...args)=>{newChatCalls++;return originalNewChat(...args)};const payload=glassCalls.at(-1),button=payload.buttons.find(b=>b.symbol==='square.and.pencil');window.oldNativeAction={...button,revision:payload.revision};window.dispatchEvent(new CustomEvent('morzsa-native-action',{detail:oldNativeAction}))});await tick();
 check(await page.evaluate(()=>newChatCalls===1),'native new chat invokes existing business handler');
 await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('morzsa-native-action',{detail:oldNativeAction}))});await tick();check(await page.evaluate(()=>newChatCalls===1),'stale native action cannot act after rerender');
 await page.evaluate(()=>{glassMode='reject';document.querySelector('#companion-form button[type=submit]').disabled=true});await tick();await tick();check(await page.locator('.ios-native-control').count()===0,'bridge failure restores web controls and accessibility');
 await page.evaluate(()=>{glassMode='normal';document.querySelector('#companion-form button[type=submit]').disabled=false;window.dispatchEvent(new Event('morzsa-resume'))});await tick();check(await page.locator('.ios-native-control').count()>0,'resume restores native controls after failure');
 await page.evaluate(()=>native.dispose());await tick();check(await page.locator('.ios-native-control').count()===0,'disposal restores all web controls');
 // Artificially hold history sync: user feedback must precede any provider call.
 await page.evaluate(()=>{
  window.oldBegin=MorzsaPersistence.beginTurn;window.held=[];
  MorzsaPersistence.beginTurn=(...args)=>new Promise((resolve,reject)=>{held.push({resolve,reject,args});args[1]?.signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true})});
 });
 await page.locator('#companion-input').fill('Küldési próba');await page.locator('#companion-form button[type=submit]').click();
 await page.locator('.companion-pending-send').waitFor();check(await page.locator('.companion-pending-send').innerText().then(s=>s.includes('Küldési próba')&&s.includes('Küldés')),'message is visible before history synchronization completes');
 check(await page.locator('#companion-input').inputValue()==='','composer clears immediately');
 await page.evaluate(()=>document.querySelector('#companion-form button[type=submit]').click());
 check(await page.locator('.companion-pending-send').count()===1,'rapid repeat tap does not duplicate or cancel a pending send');
 await page.waitForTimeout(450);await page.locator('#companion-form button[type=submit]').click();await page.locator('[data-retry]').waitFor();
 check(await page.locator('#companion-input').inputValue()==='Küldési próba','canceled history sync restores unsent text');
 check(await page.locator('.companion-pending-send').count()===0,'cancellation removes the ephemeral bubble');
 await page.evaluate(()=>MorzsaPersistence.beginTurn=oldBegin);
 await page.locator('#companion-input').fill('Első üzenet');
 await page.evaluate(()=>{MorzsaPersistence.beginTurn=(...args)=>new Promise((resolve,reject)=>{window.releaseHistory=()=>oldBegin(...args).then(resolve,reject)})});
 await page.locator('#companion-form button[type=submit]').click();await page.locator('.companion-pending-send').waitFor();await page.waitForFunction(()=>!!window.releaseHistory);
 await page.locator('#companion-input').fill('A következő kérdésem');await page.evaluate(()=>releaseHistory());
 await page.locator('#companion-form [data-action=send]').waitFor();
 check(await page.locator('#companion-input').inputValue()==='A következő kérdésem','successful submission preserves the next draft typed during preparation');
 check(await page.locator('.companion-message.user').count()===1,'one completed send creates exactly one persisted user message');
 await page.evaluate(()=>MorzsaPersistence.beginTurn=oldBegin);
 return {passed:true,count:checks.length,checks};
}
