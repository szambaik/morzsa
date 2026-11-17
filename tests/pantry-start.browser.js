// Isolated personal fixture, actual UI interactions, fake microphone and AI only.
async page=>{
 const browser=page.context().browser(),ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),checks=[],errors=[],out='/Users/I769428/Documents/ChatGPT/Főzés/konyha-app/design/pantry-start-2026-11-16';
 const check=(v,name)=>{if(!v)throw Error(name);checks.push(name)},settled=()=>p.waitForFunction(()=>MorzsaPersistence.status()==='synced'&&!household.busy);
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8850/?actor=c&pantry-start-test=1');await settled();
  await p.evaluate(()=>{commitState({...state,stock:{Vaj:7},cart:[{name:'Kenyér',quantity:2,unit:'db',done:false,notes:'keep'}],custom:[],history:[]});MorzsaOnboarding.open()});
  for(let i=0;i<4;i++){check((await p.locator('.intro-tour-progress').innerText()).includes((i+1)+' / 4'),'tour card '+(i+1));check(await p.locator('.intro-tour-points li').count()===3,'tour practical hints '+(i+1));await p.locator('[data-intro-next]').click()}
  check(await p.locator('[data-intro-voice]').isVisible(),'tour leads to pantry setup');check(await p.locator('[data-intro-save]').isDisabled(),'nothing preselected');
  await p.locator('[data-intro-pack=spices]').click();await p.locator('[data-intro-pack-all=spices]').click();await p.locator('[data-intro-pack-item=Fahéj]').uncheck();
  check(await p.locator('[data-intro-remove]').count()===5,'pack selected with editable exception');check(await p.evaluate(()=>Object.keys(state.stock).length===1),'pack is not silently saved');
  await p.locator('[data-intro-search]').fill('rizs');await p.locator('[data-intro-product=Rizs]').click();check(await p.locator('[data-intro-remove=Rizs]').count()===1,'search adds to same draft');
  // Use the actual one-shot recording/upload/receive pipeline without audio or costs.
  await p.evaluate(()=>{
   window.__qa={attempts:0,stops:0,calls:0,realtime:0,fail:true};window.__qaVoice=household.voiceCommand;window.__qaCompanionVoice=MorzsaCompanion.voice;
   MorzsaCompanion.voice=()=>{__qa.realtime++};
   navigator.mediaDevices.getUserMedia=async()=>{__qa.attempts++;if(__qa.fail)throw new DOMException('denied','NotAllowedError');return {getTracks:()=>[{stop:()=>{__qa.stops++}}]}};
   window.MediaRecorder=class {static isTypeSupported(){return true}constructor(){this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['fake audio'],{type:'audio/webm'})});queueMicrotask(()=>this.onstop?.())}};
   household.voiceCommand=async args=>{__qa.calls++;__qa.request=args;return {transcript:'Van tej és tojás, rizs még sincs. Vaj a listára.',clarification:'',operations:[{action:'stock_add',name:'Tej',quantity:null,unit:null},{action:'stock_add',name:'Tojás',quantity:null,unit:null},{action:'stock_remove',name:'Rizs',quantity:null,unit:null},{action:'list_set',name:'Vaj',quantity:1,unit:'db'}]}};
  });
  await p.locator('[data-intro-voice]').click();await p.locator('#voice-text').waitFor();await p.locator('#voice-text').click();check(await p.locator('[data-intro-remove]').count()===6,'permission fallback preserves selection');check(await p.locator('[data-intro-search]').evaluate(el=>el===document.activeElement),'fallback focuses search');
  await p.locator('[data-intro-voice]').click();await p.locator('#voice-retry').waitFor();await p.evaluate(()=>{__qa.fail=false});await p.locator('#voice-retry').click();await p.locator('#voice-send').waitFor();check(await p.locator('.voice-record-hint').innerText().then(t=>t.includes('Sorold fel')),'retry remains pantry dictation');await p.locator('#voice-send').click();await p.locator('#voice-dialog').waitFor({state:'hidden'});
  check(await p.evaluate(()=>__qa.calls===1&&__qa.request.destination==='stock'&&__qa.request.audio&&__qa.stops===1&&__qa.realtime===0),'recording sends once, cleans up, bypasses realtime');
  check(await p.locator('[data-intro-remove=Tej]').count()===1&&await p.locator('[data-intro-remove=Tojás]').count()===1&&await p.locator('[data-intro-remove=Rizs]').count()===0,'voice edits draft with no duplicate ingredients');
  check(await p.evaluate(()=>Object.keys(state.stock).length===1&&state.cart.length===1),'dictation has not changed saved pantry or list');
  await p.evaluate(()=>{window.__qaSave=saveVoiceState;saveVoiceState=async()=>false});await p.locator('[data-intro-save]').click();check(await p.locator('.intro-feedback').innerText().then(t=>t.includes('Nem sikerült')),'save failure is explained');check(await p.locator('[data-intro-remove]').count()===7,'failed save preserves draft');await p.evaluate(()=>{saveVoiceState=__qaSave});await p.locator('[data-intro-save]').click();await p.locator('[data-intro-pantry]').waitFor();
  check(await p.evaluate(()=>state.stock.Tej===2&&state.stock.Tojás===2&&state.stock.Vaj===7&&!Object.hasOwn(state.stock,'Fahéj')&&!Object.hasOwn(state.stock,'Rizs')&&state.cart.length===1&&state.cart[0].notes==='keep'),'explicit save keeps exclusions, existing quantities, and list metadata');
  await p.locator('[data-intro-pantry]').click();await p.locator('#workspace-quick-add').click();check(await p.locator('[data-pantry-setup]').isVisible(),'setup accessible from pantry');await p.locator('[data-pantry-setup]').click();check(await p.locator('[data-intro-save]').isDisabled(),'later setup begins empty');await p.locator('[data-intro-skip]').click();check(await p.locator('.pantry-library').isVisible(),'cancel setup returns to pantry');
  // Every item can be re-added even when an older purchase is still checked.
  await p.evaluate(()=>{commitState({...state,stock:{Tej:2},cart:[{name:'Tej',quantity:3,unit:'l',done:true,notes:'keep',recipeNeeds:[{recipe:{title:'Puding'}}]}]});dashboardGo('pantry')});
  await p.locator('.pantry-card-actions [data-pantry-list=Tej]').click();check(await p.evaluate(()=>state.cart.length===1&&!state.cart[0].done&&state.cart[0].quantity===3&&state.cart[0].recipeNeeds[0].recipe.title==='Puding'),'one tap reopens checked item and preserves metadata');check(await p.locator('.pantry-card-actions [data-pantry-list=Tej]').isDisabled(),'no duplicate pantry add');
  await p.evaluate(()=>{
   const now=Date.now(),trip=(days,id)=>({id,date:new Date(now-days*86400000).toISOString(),items:[{name:'Zabpehely'}]});
   commitState({...state,stock:{Tej:0,Tojás:1,Vaj:2},cart:[{name:'Alma',quantity:2,unit:'db',done:false}],history:[trip(6,'a'),trip(12,'b')]});dashboardGo('shopping');
  });
  check(await p.locator('[data-shopping-recommend]').count()===3,'three data-backed suggestions');check(await p.locator('[data-shopping-recommend=Tej]').innerText().then(t=>t.includes('Elfogyottnak')),'real out-of-stock reason');check(await p.locator('[data-shopping-recommend=Zabpehely]').innerText().then(t=>t.includes('2 vásárlás')),'real repeat-purchase reason');
  await p.locator('[data-shopping-recommend=Tej]').click();check(await p.evaluate(()=>state.cart.filter(i=>i.name==='Tej').length===1&&state.stock.Tej===0),'suggestion adds list item only');check(await p.locator('[data-shopping-recommend=Tej]').count()===0,'listed suggestion disappears');
  for(const width of [320,360,390,430,1440]){
   await p.setViewportSize({width,height:width>700?1000:844});await p.evaluate(()=>{dashboardGo('shopping');window.scrollTo({top:0,behavior:'instant'})});
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'list fits '+width);const start=await p.locator('[data-start-shopping]').boundingBox(),nav=width<1000?await p.locator('.app>nav').boundingBox():null;check(start&&start.y>500&&start.y+start.height<= (width<1000?nav.y:1000)+1,'start near bottom without nav overlap '+width);
   if(width===390)await p.screenshot({path:out+'/shopping-list-390.png'});
   await p.locator('[data-start-shopping]').click();check(await p.locator('.shopping-recommendations').count()===0,'no suggestions in store '+width);check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'shopping fits '+width);check(await p.locator('[data-exit-shopping]').count()===1,'one exit control '+width);
   const exit=await p.locator('[data-exit-shopping]').boundingBox();check(exit&&exit.y>600&&exit.y+exit.height<=await p.evaluate(()=>innerHeight),'exit reachable at bottom '+width);
   if(width===390)await p.screenshot({path:out+'/shopping-mode-390.png'});
   await p.locator('[data-exit-shopping]').click();check(await p.evaluate(()=>ShoppingMode.active()&&!ShoppingMode.visible()),'exit keeps session '+width);
  }
  await p.setViewportSize({width:390,height:844});await p.locator('[data-start-shopping]').click();await p.locator('[data-item=Alma] [data-check-item]').click();await p.locator('[data-exit-shopping]').click();await p.locator('[data-start-shopping]').click();check(await p.evaluate(()=>state.cart.find(i=>i.name==='Alma').done),'switch retains checkmarks');await p.locator('[data-finish-shopping]').click();check(await p.locator('dialog[open]').count()===1,'finish still asks to confirm purchases');await p.locator('#finish-cancel').click();await p.locator('[data-exit-shopping]').click();
  await p.evaluate(()=>{commitState({...state,stock:{},cart:[],history:[]});dashboardGo('shopping')});check(await p.locator('.shopping-recommendations').count()===0,'no fabricated recommendations for new user');
  // Check both language layouts including long setup packs on the narrowest phone.
  for(const lang of ['hu','en'])for(const width of [320,360,390,430,1440]){
   await p.setViewportSize({width,height:width>700?1000:844});await p.evaluate(lang=>{setLanguage(lang);MorzsaOnboarding.open()},lang);check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'tour fits '+lang+' '+width);if(lang==='hu'&&width===390)await p.screenshot({path:out+'/tour-390.png'});
   await p.locator('[data-intro-setup]').click();await p.locator('[data-intro-pack=spices]').click();await p.locator('[data-intro-pack-all=spices]').click();check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'pack setup fits '+lang+' '+width);const b=await p.locator('[data-intro-save]').boundingBox();check(b&&b.y>=0&&b.y+b.height<=await p.evaluate(()=>innerHeight),'setup save reachable '+lang+' '+width);if(lang==='hu'&&width===390)await p.screenshot({path:out+'/setup-390.png'});
   await p.locator('[data-intro-skip]').click();
  }
  check(errors.length===0,'no page errors: '+errors.join('; '));return {passed:true,count:checks.length,checks,errors};
 }catch(e){await p.screenshot({path:out+'/failure.png',fullPage:true});throw Error(e.message+'; last check: '+checks.at(-1))}finally{await ctx.close()}
}
