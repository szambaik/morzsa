import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {auditContext} from './browser.mjs';
import {startFixture} from './fixture.mjs';

export async function reproduceEmpty({repoRoot=path.resolve(import.meta.dirname,'..'),outputDir}) {
 fs.mkdirSync(outputDir,{recursive:false});const fixture=await startFixture({repoRoot});let browser;
 try {
  browser=await chromium.launch({headless:true,channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'});
  const {context}=await auditContext(browser,fixture.origin);const p=await context.newPage();p.setDefaultTimeout(8000);
  await p.goto(fixture.origin);await p.waitForFunction(()=>window.MorzsaCompanion&&MorzsaPersistence.status()==='synced');
  const before=await p.evaluate(()=>JSON.stringify({stock:state.stock,cart:state.cart}));
  await p.evaluate(()=>MorzsaCompanion.newChat());
  fixture.ai.push({output:{answer:'',operations:[],clarification:'',recipes:[],transcript:''}});
  const question='Mit jelent a blansírozás?';await p.locator('#companion-input').fill(question);
  const sent=p.waitForRequest(r=>r.method()==='POST'&&r.url().includes('/functions/')&&r.postDataJSON()?.text===question);
  await p.locator('#companion-input').press('Enter');await sent;
  await p.waitForFunction(()=>!document.querySelector('.companion-thinking')&&MorzsaPersistence.status()==='synced');
  const observed=await p.evaluate(()=>({text:document.body.innerText,retry:!!document.querySelector('[data-retry]'),error:!!document.querySelector('.companion-error'),canApply:!!document.querySelector('[data-companion-apply]'),state:JSON.stringify({stock:state.stock,cart:state.cart})}));
  await p.screenshot({path:path.join(outputDir,'empty-answer.png'),animations:'disabled'});
  fs.writeFileSync(path.join(outputDir,'empty-answer.txt'),await p.locator('body').ariaSnapshot());
  const result={question,observed,checks:[
   {id:'F-EMPTY-STATE-REPRO',title:'Empty AI response does not mutate inventory or list',status:before===observed.state&&!observed.canApply?'passed':'failed'},
   {id:'F-EMPTY-RECOVERY-REPRO',title:'Empty service output exposes recovery instead of inventing a clarification',status:observed.retry&&observed.error&&!observed.text.includes('Pontosítanád egy kicsit?')?'passed':'failed'}
  ],requests:fixture.calls};
  fs.writeFileSync(path.join(outputDir,'results.json'),JSON.stringify(result,null,2));
  return result;
 }finally {await browser?.close();await fixture.close()}
}
if(process.argv[1]===import.meta.filename){const r=await reproduceEmpty({outputDir:path.resolve(process.argv[2])});console.log(JSON.stringify(r.checks,null,2));process.exitCode=r.checks.some(c=>c.status==='failed')?2:0;}
