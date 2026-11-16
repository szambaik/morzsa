// Independent narrow reproduction: two real browser contexts, synthetic SQL only.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {auditContext} from './browser.mjs';
import {startFixture} from './fixture.mjs';

export async function reproduceConflict({repoRoot=path.resolve(import.meta.dirname,'..'),outputDir}) {
 fs.mkdirSync(outputDir,{recursive:false});
 const fixture=await startFixture({repoRoot});let browser;
 try {
  browser=await chromium.launch({headless:true,channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'});
  async function open(actor) {
   const {context}=await auditContext(browser,fixture.origin,{actor,shared:true});
   const page=await context.newPage();page.setDefaultTimeout(8000);await page.goto(fixture.origin);
   await page.waitForFunction(()=>window.MorzsaWorkspace&&household.active&&!household.busy);
   return page;
  }
  const a=await open('a');await a.locator('nav [data-page=shopping]').click();
  await a.evaluate(()=>MorzsaWorkspace.quick('cart'));
  await a.locator('#workspace-entry input').fill('Tej');await a.locator('#workspace-entry input').press('Enter');
  await a.locator('.workspace-entry-save').click();
  await a.waitForFunction(()=>!household.cartPending&&!household.busy&&state.cart.some(i=>i.name==='Tej'));
  const b=await open('b');await b.locator('nav [data-page=shopping]').click();
  await a.locator('[data-item=Tej] .shopping-product-open').click();
  await b.locator('[data-item=Tej] .shopping-product-open').click();
  await b.locator('#shopping-item-form [name=quantity]').fill('3');
  await b.locator('#shopping-item-form [name=unit]').selectOption('l');
  await b.locator('#shopping-item-form .primary').click();
  await b.waitForFunction(()=>!household.cartPending&&!household.busy);
  await a.locator('#shopping-item-form [name=quantity]').fill('2');
  await a.locator('#shopping-item-form [name=unit]').selectOption('l');
  await a.locator('#shopping-item-form .primary').click();
  await a.waitForFunction(()=>!household.cartPending&&!household.busy);
  const observed=await a.evaluate(()=>({
   item:state.cart.find(i=>i.name==='Tej'),
   receipt:document.querySelector('#shopping-action-feedback')?.innerText||'',
   conflictNotice:document.querySelector('#toast')?.innerText||'',
   outboxPending:household.cartPending,busy:household.busy
  }));
  const startReachable=await a.locator('[data-start-shopping]').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});
  await a.screenshot({path:path.join(outputDir,'conflicting-save.png')});
  fs.writeFileSync(path.join(outputDir,'conflicting-save.txt'),await a.locator('body').ariaSnapshot());
  const sql=(await fixture.db.query("select bucket,key,value,revision from public.household_records where bucket='cart'")).rows;
  const result={observed,sql,checks:[
   {id:'G-CONFLICT-DATA-REPRO',status:observed.item.quantity===3&&observed.item.unit==='l'?'passed':'failed',title:'Independent conflict reproduction keeps partner 3 l'},
   {id:'G-CONFLICT-RECEIPT-REPRO',status:/Mentve: 2 l/.test(observed.receipt)?'failed':'passed',title:'Rejected shared edit never retains a success receipt for 2 l'},
   {id:'C-START-REACHABLE-REPRO',status:startReachable?'passed':'failed',title:'Start shopping remains hit-test reachable while receipt visible'}
  ],requests:fixture.calls};
  fs.writeFileSync(path.join(outputDir,'results.json'),JSON.stringify(result,null,2));
  return result;
 }finally {await browser?.close();await fixture.close()}
}
if(process.argv[1]===import.meta.filename) {
 const result=await reproduceConflict({outputDir:path.resolve(process.argv[2])});
 console.log(JSON.stringify({checks:result.checks,observed:result.observed},null,2));
 process.exitCode=result.checks.some(c=>c.status==='failed')?2:0;
}
