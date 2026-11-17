// Run after build:mobile, against MORZSA_QA_PROACTIVE=1 MORZSA_QA_PORT=8899 node tests/persistence-fixture.mjs.
async page=>{
 const base='http://127.0.0.1:8899',browser=page.context().browser(),contexts=[],checks=[],errors=[];
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
 const open=async(native=false)=>{
  const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});contexts.push(c);
  await c.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
   if(url.pathname==='/dist/index.html')return route.fulfill({response:await route.fetch(),contentType:'text/html'});
   return route.continue();
  });
  if(native)await c.addInitScript(origin=>{
   Object.defineProperty(window,'MORZSA_CLOUD',{get:()=>({url:origin,publishableKey:'qa'}),set(){}});
   localStorage.setItem('morzsa-introduction-v1','seen');
   localStorage.setItem('morzsa-v1',JSON.stringify({stock:{Tej:1,Tojás:2},cart:[{name:'Vaj',quantity:1,unit:'csomag',done:false}],custom:[],likes:[]}));
  },base);
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+(native?'/dist/index.html':'/?actor=c'));
  await p.waitForFunction(()=>!!window.MorzsaWorkspace&&!!window.MorzsaCompanion&&!!window.MorzsaProactive);return p;
 };
 const install=async(p,mode='normal')=>p.evaluate(async mode=>{
  const {installIOSUI}=await import('/mobile/ios-ui.js');
  window.nativeCalls=[];window.nativeActions=[];window.haptics=0;window.nativeMode=mode;
  document.documentElement.classList.add('native-app');
  window.iosAdapter=installIOSUI({
   setNavigation(value){nativeCalls.push(value);if(nativeMode==='reject')return Promise.reject(Error('bridge offline'));if(nativeMode==='defer')return new Promise(resolve=>window.nativeResolve=resolve);return Promise.resolve({height:nativeMode==='invalid'?NaN:value.hidden?0:83})},
   showActions(value){nativeActions.push(value);return new Promise(resolve=>window.resolveActions=resolve)},
   selectionFeedback(){haptics++;return Promise.resolve()}
  });
 },mode);
 const tick=async p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const nav=async(p,page)=>{await p.evaluate(page=>{const event=new Event('morzsa-native-tab');event.page=page;window.dispatchEvent(event)},page);await p.waitForFunction(page=>document.querySelector('.app').dataset.page===page,page);await tick(p)};
 try{
  const p=await open();await install(p,'defer');await tick(p);
  check(await p.locator('html').evaluate(el=>!el.classList.contains('native-tabbar')),'web navigation remains until acknowledgment');
  await p.evaluate(()=>{nativeMode='normal';nativeResolve({height:83})});await tick(p);
  check(await p.locator('html').evaluate(el=>el.classList.contains('native-tabbar')),'successful native acknowledgment enables navigation');
  await p.evaluate(()=>{nativeCalls=[];for(let i=0;i<20;i++){MorzsaWorkspace.mount();updateCount()}});await tick(p);
  check(await p.evaluate(()=>nativeCalls.length===0),'unchanged render state does not call native bridge');
  await p.evaluate(()=>{for(let i=1;i<=20;i++)document.getElementById('cart-count').textContent=i});await tick(p);
  check(await p.evaluate(()=>nativeCalls.length===1&&nativeCalls[0].count===20),'count updates coalesce into one bridge call');
  await p.evaluate(()=>MorzsaCompanion.newChat());await p.locator('#companion-input').fill('Holnap folytatom ezt a kérdést.');
  await nav(p,'pantry');await nav(p,'chat');check(await p.locator('#companion-input').inputValue()==='Holnap folytatom ezt a kérdést.','native tab navigation preserves conversation draft');
  await p.evaluate(()=>{const e=new Event('morzsa-native-tab');e.page='unknown';window.dispatchEvent(e)});check(await p.evaluate(()=>document.querySelector('.app').dataset.page==='chat'),'unknown native destinations ignored');
  for(const className of ['keyboard-open']){
   await p.evaluate(c=>document.documentElement.classList.add(c),className);await tick(p);check(await p.evaluate(()=>nativeCalls.at(-1).hidden&&document.documentElement.style.getPropertyValue('--native-tabbar-height')==='0px'),'keyboard hides native navigation');
   await p.evaluate(c=>document.documentElement.classList.remove(c),className);await tick(p);check(await p.evaluate(()=>!nativeCalls.at(-1).hidden),'keyboard dismissal restores native navigation');
  }
  await p.evaluate(()=>document.getElementById('quantity-dialog').showModal());await tick(p);check(await p.evaluate(()=>nativeCalls.at(-1).hidden),'web modal hides native navigation');
  await p.evaluate(()=>document.getElementById('quantity-dialog').close());await tick(p);check(await p.evaluate(()=>!nativeCalls.at(-1).hidden),'closing modal restores navigation');
  await p.evaluate(()=>{const voice=document.createElement('section');voice.id='realtime-voice';document.body.append(voice)});await tick(p);check(await p.evaluate(()=>nativeCalls.at(-1).hidden),'voice overlay hides native navigation without rerender');
  await p.evaluate(()=>document.getElementById('realtime-voice').remove());await tick(p);check(await p.evaluate(()=>!nativeCalls.at(-1).hidden),'removing voice overlay restores navigation');
  await p.evaluate(()=>setLanguage('en'));await tick(p);check(await p.evaluate(()=>nativeCalls.at(-1).language==='en'),'language change reaches native labels');
  await p.evaluate(()=>{setLanguage('hu');commitState({...state,stock:{Tej:1,Tojás:2,Liszt:2},cart:[]})});
  await nav(p,'recipes');await p.locator('.proactive-recommendations [data-proactive-recipe]').first().click();await p.locator('.recipe-reading').waitFor();
  await nav(p,'shopping');await nav(p,'recipes');check(await p.locator('.recipe-reading').count()===1,'native tab navigation preserves active recipe');
  await p.evaluate(()=>{commitState({...state,stock:{Tej:1,Vaj:0},cart:[]});dashboardGo('overview')});await tick(p);
  const summary=p.locator('[data-proactive-card="product:tej"] summary');await summary.click();
  check(await p.evaluate(()=>nativeActions.length===1&&nativeActions[0].cancel==='Mégse'),'suggestion opens native action sheet');
  check(await p.locator('[data-proactive-card="product:tej"] details').evaluate(el=>!el.open),'native sheet suppresses duplicate web menu');
  await p.evaluate(()=>resolveActions({index:-1}));await tick(p);check(await p.locator('[data-proactive-card="product:tej"]').count()===1,'cancel leaves suggestion untouched');
  await summary.click();await p.evaluate(()=>resolveActions({index:nativeActions.at(-1).actions.findIndex(label=>label.includes('Máskor'))}));await tick(p);
  check(await p.evaluate(()=>!MorzsaProactive.products().some(s=>s.name==='Tej')&&state.cart.length===0&&state.stock.Tej===1),'native sheet delegates snooze to existing nonmutating action');
  await p.locator('[data-proactive-card="product:vaj"] summary').click();await nav(p,'shopping');await p.evaluate(()=>resolveActions({index:1}));await tick(p);
  check(await p.evaluate(()=>MorzsaProactive.products().some(s=>s.name==='Vaj')),'stale action sheet cannot act after navigation');
  await p.evaluate(()=>{window.matchCalls=0;window.originalMatch=QuickEntry.match;QuickEntry.match=function(...args){matchCalls++;return originalMatch(...args)};MorzsaProactive.recommendations();matchCalls=0;MorzsaProactive.recommendations()});
  check(await p.evaluate(()=>matchCalls===0),'unchanged ingredient catalog reuses resolved recipe names');
  await p.evaluate(()=>{state.custom.push({name:'Teszt új alapanyag',category:'Saját tételek'});MorzsaProactive.recommendations()});check(await p.evaluate(()=>matchCalls>0),'custom catalog changes invalidate ingredient resolutions');
  await p.evaluate(()=>{QuickEntry.match=originalMatch;state.custom=state.custom.filter(i=>i.name!=='Teszt új alapanyag')});
  await p.evaluate(()=>{nativeMode='reject';document.getElementById('cart-count').textContent='99'});await tick(p);
  check(await p.locator('html').evaluate(el=>!el.classList.contains('native-tabbar')),'bridge rejection restores web navigation');
  const failedCalls=await p.evaluate(()=>nativeCalls.length);await p.evaluate(()=>{for(let i=0;i<5;i++)MorzsaWorkspace.mount()});await tick(p);check(await p.evaluate(()=>nativeCalls.length)===failedCalls,'failed bridge does not enter a retry loop');
  await p.evaluate(()=>{nativeMode='normal';window.dispatchEvent(new Event('morzsa-resume'))});await tick(p);check(await p.locator('html').evaluate(el=>el.classList.contains('native-tabbar')),'resume retries a previously failed bridge');
  await p.evaluate(()=>iosAdapter.dispose());await tick(p);const count=await p.evaluate(()=>nativeCalls.length);await p.evaluate(()=>{updateCount();MorzsaWorkspace.mount();window.dispatchEvent(new Event('morzsa-resume'))});await tick(p);check(await p.evaluate(()=>nativeCalls.length)===count,'dispose removes listeners and wrappers');
  const invalid=await open();await install(invalid,'invalid');await tick(invalid);check(await invalid.locator('html').evaluate(el=>!el.classList.contains('native-tabbar')),'invalid native inset retains usable web navigation');
  const bundled=await open(true);check(await bundled.evaluate(()=>state.stock.Tej===1&&state.stock['Tojás']===2&&state.cart.some(i=>i.name==='Vaj')),'bundled classic runtime loads legacy morzsa-v1 pantry and list');
  check(await bundled.evaluate(()=>typeof render==='function'&&typeof updateCount==='function'&&typeof dashboardGo==='function'),'classic globals remain available in native build');
  await install(bundled);await tick(bundled);
  for(const destination of ['shopping','chat','pantry','recipes','overview']){await nav(bundled,destination);check(await bundled.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'bundled '+destination+' fits the viewport')}
  check(await bundled.evaluate(()=>document.styleSheets.length===1&&document.scripts.length===3),'native entry point loads three scripts and one stylesheet');
  check(await bundled.evaluate(()=>getComputedStyle(document.body).fontFamily.includes('-apple-system')),'native build uses local system fonts');
  check(errors.length===0,'no browser runtime errors: '+errors.join(', '));
  return {passed:true,count:checks.length,checks};
 }catch(e){throw Error(e.message+'; last passed: '+checks.at(-1)+'; runtime errors: '+errors.join(', '))}finally{for(const c of contexts)await c.close()}
}
