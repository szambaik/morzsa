async(page)=>{
 const browser=page.context().browser(),ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),errors=[];
 const check=(v,m)=>{if(!v)throw Error(m)};p.on('pageerror',e=>errors.push(e.message));
 let holdRead=false,readGate=null,fail=false,hold=null,delayFirst=true,writes=0,conflicts=0;
 const rows=['Tej','Vaj','Sajt','Tojás','Joghurt','Tejföl','Tejszín','Túró','Kefir','Krumpli','Hagyma','Paprika'].map(name=>({bucket:'cart',key:name,value:{name,quantity:1,unit:name==='Tej'?'l':'db',done:false},revision:1}));
 await ctx.addInitScript(()=>{localStorage.setItem('morzsa-session',JSON.stringify({access_token:'mock',expires_at:9999999999,user:{id:'u'}}));localStorage.setItem('morzsa-last-household-u',JSON.stringify({id:'h'}));window.WebSocket=class{constructor(){this.readyState=0}close(){}send(){}}});
 await ctx.route('https://cbgcugshwivxpaurzyqq.supabase.co/**',async r=>{
  const url=r.request().url();if(url.includes('/households?'))return r.fulfill({json:[{id:'h',name:'Közös otthon',owner_id:'u'}]});
  if(url.includes('/household_records?')){const snapshot=JSON.parse(JSON.stringify(rows));if(holdRead){holdRead=false;await new Promise(resolve=>readGate=resolve)}return r.fulfill({json:snapshot})}
  if(url.includes('apply_household_changes')){writes++;if(fail)return r.fulfill({status:503,json:{message:'Offline'}});const changes=r.request().postDataJSON().changes;
   if(delayFirst){delayFirst=false;await new Promise(resolve=>hold=resolve)}
   for(const c of changes){const old=rows.find(x=>x.bucket===c.bucket&&x.key===c.key);if((old?.revision||0)!==c.expected){conflicts++;return r.fulfill({status:409,json:{message:'Conflict'}})}}
   for(const c of changes){const index=rows.findIndex(x=>x.bucket===c.bucket&&x.key===c.key),record={bucket:c.bucket,key:c.key,value:c.value,revision:c.expected+1};if(index<0)rows.push(record);else rows[index]=record}
   return r.fulfill({json:null});
  }return r.fulfill({json:[]});
 });
 const item=n=>p.locator('.list-row').filter({has:p.locator('[data-item="'+n+'"]')});
 const row=n=>p.locator('.list-row[data-item="'+n+'"]');
 try{
  await p.goto('http://localhost:8771/');await p.waitForFunction(()=>household.active==='h'&&!household.busy);check(await p.locator('nav [data-page=shopping]').getAttribute('aria-current')==='page','shopping is start screen');
  await p.evaluate(()=>window.initialMilk=document.querySelector('[data-item="Tej"]'));
  await row('Tej').locator('[data-cart]').check();while(!hold)await p.waitForTimeout(10);
  const started=Date.now();await row('Vaj').locator('[data-cart]').check();await row('Sajt').locator('[data-cart]').check();await row('Tej').locator('[data-cart]').uncheck();await row('Vaj').locator('[data-step="1"]').click();
  check(Date.now()-started<1200,'multiple checks complete before server responds');check(await p.evaluate(()=>window.initialMilk===document.querySelector('[data-item="Tej"]')),'row DOM remains stable');check(await p.evaluate(()=>state.cart.find(i=>i.name==='Vaj').done&&state.cart.find(i=>i.name==='Sajt').done&&!state.cart.find(i=>i.name==='Tej').done),'local checks immediate');
  rows.find(r=>r.key==='Tej').value.quantity=9;rows.find(r=>r.key==='Tej').revision++;hold();
  await p.waitForFunction(()=>!household.busy&&!localStorage.getItem('morzsa-cart-outbox-u-h'));check(rows.find(r=>r.key==='Tej').value.quantity===9,'partner quantity preserved after conflict');check(rows.find(r=>r.key==='Tej').value.done===false,'latest toggle preserved');check(rows.find(r=>r.key==='Vaj').value.quantity===2&&rows.find(r=>r.key==='Sajt').value.done,'queued follow-up saved');check(conflicts===1,'stale write rebased once');
  await p.screenshot({path:'/Users/I769428/Documents/ChatGPT/Főzés/konyha-app/design/shopping-compact.png'});const height=(await row('Tej').boundingBox()).height;check(height<=48,'dense rows retain 44px controls');
  holdRead=true;await p.evaluate(()=>window.dispatchEvent(new Event('online')));while(!readGate)await p.waitForTimeout(10);await row('Joghurt').locator('[data-cart]').check();check(await p.evaluate(()=>state.cart.find(i=>i.name==='Joghurt').done),'check works during background read');readGate();await p.waitForFunction(()=>!household.busy&&!localStorage.getItem('morzsa-cart-outbox-u-h'));check(rows.find(r=>r.key==='Joghurt').value.done,'stale background response preserves queued check');
  fail=true;await row('Tojás').locator('[data-cart]').check();await p.getByRole('button',{name:'Újrapróbálás',exact:true}).waitFor();check(await p.evaluate(()=>state.cart.find(i=>i.name==='Tojás').done),'failed save remains visible');check(await p.evaluate(()=>!!localStorage.getItem('morzsa-cart-outbox-u-h')),'failure durable');await p.reload();await p.waitForFunction(()=>household.active==='h'&&!household.busy);check(await p.evaluate(()=>state.cart.find(i=>i.name==='Tojás').done),'reload keeps pending intent');fail=false;await p.getByRole('button',{name:'Újrapróbálás',exact:true}).click();await p.waitForFunction(()=>!localStorage.getItem('morzsa-cart-outbox-u-h'));check(rows.find(r=>r.key==='Tojás').value.done,'retry sends recovered intent');
  await p.locator('#add-cart input').fill('Paradicsom,');await p.waitForFunction(()=>state.cart.some(i=>i.name==='Paradicsom'));await p.waitForFunction(()=>!household.busy&&!localStorage.getItem('morzsa-cart-outbox-u-h'));check(rows.some(r=>r.key==='Paradicsom'&&r.value),'quick entry uses queue');
  await p.setViewportSize({width:320,height:740});await p.locator('[data-language=en]').click();await p.screenshot({path:'/Users/I769428/Documents/ChatGPT/Főzés/konyha-app/design/shopping-compact-320.png'});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px English fits '+JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,10).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right]))));check((await p.locator('#shopping-pending').textContent()).includes('items'),'count localized');await p.screenshot({path:'/Users/I769428/Documents/ChatGPT/Főzés/konyha-app/design/shopping-compact-320.png'});
  check(!errors.length,errors.join('\n'));return {passed:true,writes,conflicts,rowHeight:height,checks:'immediate checks, stable DOM, queued saves, concurrent quantity, retry/reload, add, mobile density'};
 }finally{await ctx.close()}
}
