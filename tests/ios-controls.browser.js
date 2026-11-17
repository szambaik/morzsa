async page=>{
 const checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
 const base=process.env.MORZSA_QA_BASE||'http://127.0.0.1:8899';
 await page.goto(base+'/?actor=c');await page.waitForFunction(()=>!!window.MorzsaCompanion&&!!window.MorzsaWorkspace);
 await page.addStyleTag({url:base+'/mobile/ios.css'});
 check(await page.locator('#companion-form').evaluate(el=>getComputedStyle(el).display==='flex'),'web composer keeps its original layout');
 check(await page.locator('.companion-voice-glass').isHidden(),'reference voice icon is iOS-only');
 await page.evaluate(async()=>{
  // Synthetic personal pantry; no production household or provider is used.
  Object.assign(state.stock,{Tej:2,'Tojás':2,Alma:2});
  const {installIOSControls}=await import('/mobile/ios-controls.js');document.documentElement.classList.add('native-app','native-ios');
  window.glassCalls=[];window.glassMode='defer';window.native=installIOSControls({setControls:value=>{glassCalls.push(value);return glassMode==='reject'?Promise.reject(Error('bridge offline')):glassMode==='defer'?new Promise(resolve=>window.glassResolve=()=>resolve({revision:value.revision})):Promise.resolve({revision:value.revision})}});
 });
 const tick=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await tick();
 check(await page.locator('.ios-native-control').count()===0,'web buttons stay usable before native acknowledgment');
 await page.evaluate(()=>{glassMode='normal';glassResolve()});await tick();
 check(await page.locator('.ios-native-control').count()>0,'acknowledged native navigation and chat starters replace web buttons');
 check(await page.locator('.companion-starters button.ios-native-control').count()===3,'all three chat starters retain Liquid Glass');
 check(await page.locator('#companion-form [type=submit]').evaluate(el=>!el.classList.contains('ios-native-control')&&getComputedStyle(el).opacity==='1'),'Send keeps its original visible web control');
 check(await page.evaluate(()=>{const b=glassCalls.at(-1).buttons.find(b=>b.symbol==='sidebar.left');return !b||b.title===''}),'native history icon does not duplicate the web hamburger glyph');
 check(await page.locator('.ios-native-control').evaluateAll(els=>els.every(el=>el.getAttribute('aria-hidden')==='true'&&el.tabIndex===-1)),'native controls have no duplicate accessibility targets');
 check(await page.locator('#companion-form [data-photo]').evaluate(el=>!el.classList.contains('ios-native-control')),'photo picker retains trusted user activation');
 check(await page.locator('.companion-voice-glass').isVisible(),'iOS shows the reference voice icon');
 const chooser=page.waitForEvent('filechooser');await page.locator('#companion-form [data-photo]').click();await chooser;
 check(true,'iOS photo control opens the real file picker');
 await page.evaluate(()=>{window.oldCalls=glassCalls.length;for(let i=0;i<10;i++)native.refresh()});await tick();check(await page.evaluate(()=>glassCalls.length===oldCalls),'unchanged state sends no repeated control payloads');
 for(const width of [320,360,390,1366]){
  await page.setViewportSize({width,height:844});await tick();
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow at '+width);
  check(await page.evaluate(()=>{const box=el=>el.getBoundingClientRect(),form=document.getElementById('companion-form'),text=box(document.getElementById('companion-input')),buttons=[...form.querySelectorAll('button')].map(box),frame=box(form);return getComputedStyle(form).display==='grid'&&buttons.every(b=>b.width>=44&&b.height>=44&&b.top>=text.bottom&&b.left>=frame.left&&b.right<=frame.right)&&text.width>frame.width-40}),'full-width text and reachable toolbar fit at '+width);
  check(await page.evaluate(()=>glassCalls.at(-1).buttons.filter(b=>b.title==='Kotyvasszunk').every(b=>b.stacked===(innerWidth<1000))),'native starter label uses the available width at '+width);
  check(await page.locator('#workspace-kitchen').count()===0,'no duplicate header household at '+width);
  check(await page.evaluate(()=>{const a=document.getElementById('workspace-new-chat').getBoundingClientRect(),b=document.querySelector('#companion-form button[type=submit]').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<2&&a.bottom<b.top}),'new chat floats above Send at '+width);
 }
 await page.setViewportSize({width:390,height:844});await tick();
 await page.locator('#companion-input').fill('Hosszabb kérdés\nTöbb sorban\nA receptről\nÉs a készletről');
 check(await page.locator('#companion-input').evaluate(el=>el.getBoundingClientRect().height>44&&el.getBoundingClientRect().bottom<=el.closest('form').querySelector('[data-mic]').getBoundingClientRect().top),'multiline draft expands above the toolbar');
 await page.locator('#companion-input').fill('');await page.locator('#companion-input').blur();
 await page.evaluate(()=>{document.documentElement.classList.add('native-tabbar','keyboard-open');document.documentElement.style.setProperty('--native-tabbar-height','83px')});await tick();
 check(await page.locator('.companion-compose-wrap').evaluate(el=>Math.abs(innerHeight-el.getBoundingClientRect().bottom-8)<1),'keyboard leaves no hidden-tabbar gap under the composer');
 await page.evaluate(()=>{document.documentElement.classList.remove('native-tabbar','keyboard-open');document.documentElement.style.removeProperty('--native-tabbar-height')});await tick();
 for(const destination of ['pantry','shopping','overview','recipes']){
  await page.locator('.app>nav [data-page="'+destination+'"]').click();await tick();
  check(await page.locator('#main .ios-native-control').count()===0,'content actions retain their web layout on '+destination);
  check(await page.locator('details:not([open]) .ios-native-control').count()===0,'closed menus expose no native buttons on '+destination);
  if(destination==='pantry')check(await page.locator('[data-pantry-list]').first().evaluate(el=>getComputedStyle(el).opacity==='1'&&getComputedStyle(el).pointerEvents!=='none'),'pantry quick-add remains visible and interactive');
  if(['pantry','shopping'].includes(destination)){
   check(await page.locator('#workspace-assistant [data-workspace-assistant]').count()===0,'no duplicate Ask Morzsa button on '+destination);
   check(await page.locator('#workspace-new-chat').evaluate(el=>!el.hidden&&el.getBoundingClientRect().width>=44&&el.getBoundingClientRect().bottom<innerHeight),'floating new chat stays reachable on '+destination);
  }
  if(destination==='pantry')check(await page.locator('#workspace-assistant .workspace-fast-actions').count()===0,'pantry has no empty quick-action row');
  if(destination==='shopping')check(await page.locator('[data-start-shopping]').isVisible(),'shopping mode entry stays visible');
 }
 await page.locator('.app>nav [data-page="chat"]').click();await tick();
 // Exercise WebKit's closed-disclosure case with an otherwise eligible action.
 await page.evaluate(()=>{const host=document.createElement('details');host.id='glass-disclosure-test';host.style='position:fixed;top:100px;left:20px;z-index:999';host.innerHTML='<summary>Test menu</summary><button data-new-chat style="width:160px;height:44px">Hidden new chat</button>';document.body.append(host)});await tick();
 check(await page.locator('#glass-disclosure-test .ios-native-control').count()===0,'eligible controls in closed details are never mirrored');
 await page.evaluate(()=>document.getElementById('glass-disclosure-test').open=true);await tick();
 check(await page.locator('#glass-disclosure-test .ios-native-control').count()===1,'eligible control becomes native only after its disclosure opens');
 await page.evaluate(()=>document.getElementById('glass-disclosure-test').open=false);await tick();
 check(await page.locator('#glass-disclosure-test .ios-native-control').count()===0,'closing a disclosure removes its native control');
 await page.evaluate(()=>document.getElementById('glass-disclosure-test').remove());await tick();
 // History settings, sharing and archive controls must not become floating pills.
 await page.evaluate(()=>document.querySelector('.companion-header-history').click());await tick();
 await page.locator('#companion-history [data-close].ios-native-control').waitFor({state:'attached'});
 check(await page.locator('#companion-history [data-close].ios-native-control').count()===1,'history close remains native navigation');
 check(await page.locator('#companion-history [data-new-chat].ios-native-control').count()===1,'history new chat retains Liquid Glass');
 check(await page.locator('#companion-history [data-archive].ios-native-control,#companion-history .history-sharing .ios-native-control,#companion-history .workspace-settings .ios-native-control').count()===0,'history archive, sharing and settings retain web controls');
 check(await page.locator('.ios-native-control').evaluateAll(els=>els.every(el=>el.closest('#companion-history'))),'opening history removes native controls behind the dialog');
 await page.evaluate(()=>document.getElementById('companion-history').close());await tick();
 // Dispatch a real native callback. The existing web handler must create a chat.
 await page.evaluate(()=>{window.newChatCalls=0;window.originalNewChat=MorzsaCompanion.newChat;MorzsaCompanion.newChat=(...args)=>{newChatCalls++;return originalNewChat(...args)};const payload=glassCalls.at(-1),button=payload.buttons.find(b=>b.symbol==='square.and.pencil');window.oldNativeAction={...button,revision:payload.revision};window.dispatchEvent(new CustomEvent('morzsa-native-action',{detail:oldNativeAction}))});await tick();
 check(await page.evaluate(()=>newChatCalls===1),'native new chat invokes existing business handler');
 await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('morzsa-native-action',{detail:oldNativeAction}))});await tick();check(await page.evaluate(()=>newChatCalls===1),'stale native action cannot act after rerender');
 await page.evaluate(()=>{glassMode='reject';document.getElementById('workspace-new-chat').disabled=true});await tick();await tick();check(await page.locator('.ios-native-control').count()===0,'bridge failure restores web controls and accessibility');
 await page.evaluate(()=>{glassMode='normal';document.getElementById('workspace-new-chat').disabled=false;window.dispatchEvent(new Event('morzsa-resume'))});await tick();check(await page.locator('.ios-native-control').count()>0,'resume restores native controls after failure');
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
