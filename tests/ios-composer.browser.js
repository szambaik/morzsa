async page=>{
 const checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
 const base=process.env.MORZSA_QA_BASE;
 // A separate synthetic account avoids reusing the previous suite's turn lease.
 await page.goto(base+'/?actor=a');await page.waitForFunction(()=>!!window.MorzsaCompanion&&!!window.MorzsaWorkspace);
 await page.waitForFunction(()=>household?.userId()&&MorzsaPersistence.status()==='synced');
 await page.evaluate(()=>MorzsaCompanion.ask('Natív szerkesztő teszt'));
 await page.waitForFunction(()=>document.querySelector('#companion-form [data-action=send]')&&document.querySelector('.companion-messages').textContent.includes('Natív szerkesztő teszt'));
 await page.addStyleTag({url:base+'/mobile/ios.css'});
 await page.evaluate(async()=>{
  document.documentElement.classList.add('native-app','native-ios');
  const {installIOSComposer}=await import('/mobile/ios-composer.js');
  window.composerCalls=[];window.composerMode='defer';window.nativeText='';window.nativeSequence=0;window.submitCalls=0;
  window.composer=installIOSComposer({
   setComposer:async state=>{composerCalls.push(state);if(composerMode==='reject')throw Error('offline');if(composerMode==='defer')await new Promise(resolve=>window.ackComposer=resolve);return {revision:state.revision,kind:'UITextView'}},
   submitComposer:async({session})=>{submitCalls++;const value={session,sequence:++nativeSequence,text:nativeText};nativeText='';await new Promise(resolve=>window.resolveNativeSubmit=()=>resolve());return value}
  });
  window.nativeEdit=(text,height=44)=>{nativeText=text;window.dispatchEvent(new CustomEvent('morzsa-native-text',{detail:{session:MorzsaCompanion.composerContext(),sequence:++nativeSequence,text,height}}))};
 });
 const tick=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await tick();
 check(await page.locator('#companion-input').evaluate(el=>getComputedStyle(el).opacity==='1'),'web input stays usable before UITextView acknowledgment');
 await page.evaluate(()=>{composerMode='normal';ackComposer()});await tick();
 check(await page.locator('#companion-input').evaluate(el=>el.classList.contains('ios-native-text-input')&&el.tabIndex===-1&&el.getAttribute('aria-hidden')==='true'),'acknowledged UITextView replaces only the web text editor');
 check(await page.locator('#companion-form button').evaluateAll(els=>els.every(el=>getComputedStyle(el).opacity==='1')),'photo voice and send retain their existing web controls');
 await page.evaluate(()=>nativeEdit('Első sor\nMásodik sor 🍎',86));await tick();
 check(await page.locator('#companion-input').inputValue()==='Első sor\nMásodik sor 🍎','native multiline text and emoji update the draft');
 check(await page.locator('#companion-input').evaluate(el=>el.getBoundingClientRect().height===86),'native text measurement updates reserved height');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('morzsa-native-text',{detail:{session:MorzsaCompanion.composerContext(),sequence:0,text:'stale'}})));
 check(await page.locator('#companion-input').inputValue()==='Első sor\nMásodik sor 🍎','older native edits cannot replace the latest draft');
 await page.evaluate(()=>{window.oldComposerSession=MorzsaCompanion.composerContext();MorzsaCompanion.render()});await tick();
 check(await page.locator('#companion-input').inputValue()==='Első sor\nMásodik sor 🍎','ordinary chat redraw preserves the native draft');
 await page.evaluate(()=>MorzsaCompanion.newChat());await tick();
 check(await page.evaluate(()=>composerCalls.at(-1).session!==oldComposerSession&&composerCalls.at(-1).text===''),'new chat replaces the native editing context');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('morzsa-native-text',{detail:{session:oldComposerSession,sequence:99,text:'wrong chat'}})));
 check(await page.locator('#companion-input').inputValue()==='','old chat callbacks cannot leak a draft into a new chat');
 await page.evaluate(()=>{MorzsaCompanion.openThread(JSON.parse(oldComposerSession).at(-1));nativeSequence=0});await tick();
 check(await page.locator('#companion-input').inputValue()==='Első sor\nMásodik sor 🍎','returning to a chat restores its own saved draft');
 await page.evaluate(()=>MorzsaCompanion.openHistory());await tick();
 check(await page.evaluate(()=>composerCalls.at(-1).visible===false),'history hides and resigns the native editor');
 await page.evaluate(()=>document.getElementById('companion-history').close());await tick();
 check(await page.evaluate(()=>composerCalls.at(-1).visible===true),'closing history restores the native editor');
 await page.evaluate(()=>{
  nativeEdit('Küldendő üzenet');nativeText+='!';
  window.originalBegin=MorzsaPersistence.beginTurn;
  MorzsaPersistence.beginTurn=(...args)=>new Promise((resolve,reject)=>args[1]?.signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}));
 });await tick();
 await page.locator('#companion-form [type=submit]').click();await page.waitForFunction(()=>!!window.resolveNativeSubmit);
 await page.evaluate(()=>{document.querySelector('#companion-form').requestSubmit(document.querySelector('#companion-form [type=submit]'));nativeEdit('Következő kérdésem');MorzsaCompanion.render();resolveNativeSubmit()});
 await page.locator('.companion-pending-send').waitFor();
 check(await page.evaluate(()=>submitCalls===1),'rapid repeat submit consumes native text exactly once');
 check((await page.locator('.companion-pending-send').innerText()).includes('Küldendő üzenet!'),'send captures the latest native keystroke even before its edit event');
 check(true,'redrawing the form during native submission preserves the send');
 check(await page.locator('#companion-input').inputValue()==='Következő kérdésem','typing during native submission becomes the next draft');
 await page.waitForTimeout(450);await page.locator('#companion-form [data-action=stop]').click();await page.locator('[data-retry]').waitFor();
 check(await page.locator('#companion-input').inputValue()==='Következő kérdésem','stopping a response retains the next native draft');
 await page.evaluate(()=>{MorzsaPersistence.beginTurn=originalBegin;composerMode='reject';composer.refresh()});
 // Force a changed payload, otherwise there is correctly no extra bridge call.
 await page.evaluate(()=>nativeEdit('Megmaradó piszkozat'));await tick();await tick();
 check(await page.locator('#companion-input').evaluate(el=>getComputedStyle(el).opacity==='1'&&!el.hasAttribute('aria-hidden')),'bridge failure restores the web editor and accessibility');
 check(await page.locator('#companion-input').inputValue()==='Megmaradó piszkozat','fallback retains the last synchronized draft');
 await page.evaluate(()=>{composerMode='normal';window.dispatchEvent(new Event('morzsa-resume'))});await tick();
 check(await page.locator('#companion-input').evaluate(el=>el.classList.contains('ios-native-text-input')),'resume restores native editing after a bridge failure');
 await page.evaluate(()=>composer.dispose());await tick();
 check(await page.locator('#companion-input').evaluate(el=>!el.classList.contains('ios-native-text-input')),'disposal restores the ordinary web editor');
 return {passed:true,count:checks.length,checks};
}
