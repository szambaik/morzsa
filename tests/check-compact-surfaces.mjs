// Real browser controls with synthetic local data; every external request is blocked.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(new URL('../design-audit/package.json',import.meta.url));
const {chromium}=require('playwright'),out=path.join(root,'design-audit/runs/compact-surfaces-'+new Date().toISOString().replaceAll(':','-'));
fs.mkdirSync(out,{recursive:true});
const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const base='http://127.0.0.1:'+port,fixture=spawn(process.execPath,['tests/persistence-fixture.mjs'],{cwd:root,env:{...process.env,MORZSA_QA_PORT:String(port),MORZSA_QA_PROACTIVE:'1'},stdio:['ignore','pipe','pipe']});
let browser,logs='';fixture.stdout.on('data',b=>logs+=b);fixture.stderr.on('data',b=>logs+=b);const checks=[],errors=[],measurements=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label)};
try{
 let ready=false;for(let i=0;i<100;i++){if(fixture.exitCode!==null)throw Error(logs);try{ready=(await fetch(base+'/qa/status')).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100))}assert.ok(ready,'local fixture ready');
 browser=await chromium.launch({headless:true,channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true});
 await context.route('**/*',r=>r.request().url().startsWith(base+'/')||r.request().url().startsWith('data:')?r.continue():r.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/?actor=c');await page.waitForFunction(()=>MorzsaPersistence.status()==='synced');
 await page.evaluate(()=>{commitState({...state,stock:{Tej:1,Vaj:0,Tojás:2,Liszt:2,Só:2,Olaj:2},cart:[]});dashboardGo('overview')});
 for(const lang of ['hu','en'])for(const width of [320,360,390,1280]){
  await page.setViewportSize({width,height:844});await page.evaluate(lang=>{language=lang;render()},lang);
  const sizes=await page.locator('.proactive-card').evaluateAll(cards=>cards.map(e=>e.getBoundingClientRect().height));check(sizes.length>0&&sizes.every(h=>h<110),'compact reminder rows '+lang+' '+width);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overview width '+lang+' '+width);
  const entry=page.locator('.weekly-entry');check((await entry.boundingBox()).height<=76,'small closed weekly card '+lang+' '+width);
  await page.locator('[data-weekly-open]').click();
  const fits=await page.locator('[data-weekly-form]').evaluate(form=>{const bounds=form.getBoundingClientRect(),controls=[...form.querySelectorAll('input,select')].map(e=>e.getBoundingClientRect());return controls.every(a=>a.width>80&&a.height>=44&&a.left>=bounds.left&&a.right<=bounds.right+1)&&controls.every((a,i)=>controls.slice(i+1).every(b=>a.right+8<=b.left||b.right+8<=a.left||a.bottom+8<=b.top||b.bottom+8<=a.top))});
  check(fits,'weekly controls do not collide '+lang+' '+width);
  const submit=page.locator('[data-weekly-form] button[type=submit]');await submit.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
  check(await submit.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'weekly submit remains reachable '+lang+' '+width);
  await page.locator('[name=people]').selectOption('4');await page.locator('[data-weekly-open]').click();await page.locator('[data-weekly-open]').click();check(await page.locator('[name=people]').inputValue()==='4','weekly draft survives collapse '+lang+' '+width);
  if(lang==='hu'&&width===390){await entry.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await entry.screenshot({path:path.join(out,'weekly-open.png')});measurements.push({surface:'overview',heights:sizes})}
  await page.locator('[data-weekly-open]').click();
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{language='hu';render()});await page.locator('.proactive-overview').screenshot({path:path.join(out,'overview.png')});
 await page.locator('.weekly-entry').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.locator('.weekly-entry').screenshot({path:path.join(out,'weekly-closed.png')});
 await page.evaluate(()=>dashboardGo('shopping'));check(await page.locator('[data-proactive-approve]').isDisabled(),'suggestions start unselected');
 const initial=await page.evaluate(()=>JSON.stringify(state.cart));await page.locator('[data-proactive-select="product:vaj"]').check();check(await page.evaluate(()=>JSON.stringify(state.cart))===initial,'selection does not save');
 check(await page.locator('[data-proactive-select="product:vaj"]').evaluate(e=>e===document.activeElement),'selection retains focus');
 await page.locator('.proactive-shopping').screenshot({path:path.join(out,'shopping-suggestions.png')});
 await page.locator('[data-proactive-approve]').click();await page.waitForFunction(()=>state.cart.some(i=>i.name==='Vaj'));check(await page.evaluate(()=>state.stock.Vaj===0&&state.cart.filter(i=>i.name==='Vaj').length===1),'approval adds once without changing pantry');
 await page.evaluate(()=>{commitState({...state,cart:[{name:'Tej',quantity:2,unit:'l',notes:'Keep this note',done:false}]});render()});await page.locator('[data-start-shopping]').click();await page.locator('[data-toggle-shopping-add]').click();
 const input=page.locator('#shopping-mode-add input'),options=page.locator('#shopping-mode-options');const before=await page.evaluate(()=>JSON.stringify(state));
 await input.fill('toj');await options.waitFor();check(await page.evaluate(()=>JSON.stringify(state))===before,'typing suggestions never saves');
 await page.screenshot({path:path.join(out,'in-store-autocomplete.png')});
 await input.press('Escape');check(await options.isHidden()&&await input.inputValue()==='toj','Escape closes options and retains draft');
 await input.fill('toja');await input.press('ArrowDown');check(!!await input.getAttribute('aria-activedescendant'),'keyboard selection announced');await input.press('Enter');
 await page.waitForFunction(()=>state.cart.some(i=>i.name==='Tojás'&&i.done));check(await page.evaluate(()=>state.cart.filter(i=>i.name==='Tojás').length===1),'keyboard selection adds one purchased item');
 await page.locator('#shopping-action-feedback button').click();await page.waitForFunction(()=>!state.cart.some(i=>i.name==='Tojás'));check(true,'Undo removes only the new purchase');
 await input.fill('tej');await options.getByRole('option').first().tap();await page.waitForFunction(()=>state.cart.find(i=>i.name==='Tej')?.done);
 check(await page.evaluate(()=>state.cart.filter(i=>i.name==='Tej').length===1&&state.cart[0].quantity===2&&state.cart[0].notes==='Keep this note'),'existing purchase preserves quantity and notes');
 await input.fill('tej');await options.getByRole('option').first().click();check(await page.evaluate(()=>state.cart.filter(i=>i.name==='Tej').length===1&&state.cart[0].quantity===2),'repeat selection does not duplicate purchase');
 await input.fill('Kenyer, toj');await options.getByRole('option').first().click();await page.waitForFunction(()=>state.cart.some(i=>i.name==='Kenyér'&&i.done)&&state.cart.some(i=>i.name==='Tojás'&&i.done));check(true,'autocomplete retains earlier batch entries and resolves accents');
 await input.fill('Teszt magkeverék');await input.press('Enter');await page.waitForFunction(()=>state.cart.some(i=>i.name==='Teszt magkeverék'&&i.done));check(true,'free text custom purchases still work');
 await page.evaluate(()=>{language='en';render()});await input.fill('egg');check(await options.innerText().then(t=>/egg/i.test(t)),'English product names are suggested');
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const axe=await page.evaluate(()=>axe.run({include:['#shopping-mode-add']},{rules:{region:{enabled:false}}}));check(axe.violations.length===0,'autocomplete accessibility: '+axe.violations.map(v=>v.id).join(','));
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:568});await input.fill('te');await page.evaluate(()=>ShoppingMode.positionFeedback());const b=await options.boundingBox(),f=await page.locator('#shopping-mode-add').boundingBox();check(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=f.y,'autocomplete fits above input '+width)}
 check(errors.length===0,'no runtime errors: '+errors.join('; '));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,measurements,errors},null,2));console.log(JSON.stringify({out,checks:checks.length,measurements,errors},null,2));
}finally{await browser?.close();fixture.kill()}
