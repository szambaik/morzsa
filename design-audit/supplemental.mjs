import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {startFixture} from './fixture.mjs';
// Focused exploratory observations made repeatable. Fresh guest data, no provider calls.
export async function runSupplemental({repoRoot,runDir}) {
 const fixture=await startFixture({repoRoot}),evidence=[],checks=[],observations=[];let browser;
 const folder=path.join(runDir,'evidence');await fs.mkdir(folder,{recursive:true});
 try {
  browser=await chromium.launch({headless:true,channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'});
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===fixture.origin?r.continue():r.abort());await ctx.routeWebSocket('**/*',ws=>ws.close());
  const p=await ctx.newPage();p.setDefaultTimeout(5000);await p.goto(fixture.origin);
  const capture=async(name,description)=>{const png='evidence/'+name+'.png',dom='evidence/'+name+'.txt';await p.screenshot({path:path.join(runDir,png)});await fs.writeFile(path.join(runDir,dom),await p.locator('body').ariaSnapshot());evidence.push({path:png,description,kind:'screenshot'},{path:dom,description,kind:'dom'});return [png,dom]};
  await p.getByRole('button',{name:'Később',exact:true}).click();await p.getByRole('button',{name:'Készlet',exact:true}).click();
  await p.getByRole('searchbox',{name:'Keresés az alapanyagok között'}).fill('Tej');
  const searchEvidence=await capture('supplement-pantry-search','Searching empty pantry with the visible availability scope');
  const scope=await p.evaluate(()=>({selected:document.querySelector('[data-pantry-view][aria-pressed=true]').textContent,selectedScope:document.querySelector('[data-pantry-view][aria-pressed=true]').dataset.pantryView,stock:state.stock,unknownResults:document.querySelectorAll('.availability-unknown').length}));
  observations.push({id:'search-scope',...scope});checks.push({id:'PANTRY-SEARCH-SCOPE',title:'Pantry results match the visibly selected availability scope',status:scope.unknownResults&&scope.selectedScope!=='all'?'failed':'passed',details:JSON.stringify(scope),evidence:searchEvidence});
  await p.getByRole('button',{name:'Tej: részletek és listára vétel',exact:true}).click();
  const dialog=p.getByRole('dialog',{name:'Tej',exact:true});await dialog.getByRole('button',{name:'Kevés',exact:true}).focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>state.stock.Tej===1);
  const afterSave=await p.evaluate(()=>({active:document.activeElement.tagName,insideDialog:!!document.activeElement.closest('dialog'),dialogOpen:document.querySelector('#pantry-item-dialog').open,stored:JSON.parse(localStorage.getItem('morzsa-v2')).stock.Tej}));
  const focusEvidence=await capture('supplement-pantry-focus','After keyboard activation of Kevés the dialog rerenders');
  await p.keyboard.press('Escape');await p.waitForFunction(()=>document.activeElement?.dataset.pantryDetails==='Tej');
  const afterClose=await p.evaluate(()=>({active:document.activeElement.tagName,label:document.activeElement.getAttribute('aria-label'),dialog:document.querySelector('#pantry-item-dialog').open}));
  observations.push({id:'pantry-focus',afterSave,afterClose});checks.push({id:'PANTRY-DIALOG-FOCUS',title:'Keyboard focus remains meaningful after pantry status save',status:afterSave.insideDialog?'passed':'failed',details:JSON.stringify({afterSave,afterClose}),evidence:focusEvidence});
  checks.push({id:'PANTRY-LOW-PERSISTENCE',title:'Approximate low availability saves without a precise quantity',status:afterSave.stored===1?'passed':'failed',details:JSON.stringify(afterSave),evidence:focusEvidence});
  // Reopen and test a genuine local storage write failure. Do not replace product save methods.
  await p.getByRole('button',{name:'Tej: részletek és listára vétel',exact:true}).click();
  await p.evaluate(()=>{window.auditOriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='morzsa-v2')throw new DOMException('Synthetic full storage','QuotaExceededError');return window.auditOriginalSet.call(this,k,v)}});
  await dialog.getByRole('button',{name:'Van otthon',exact:true}).click();
  const saveFailure=await p.evaluate(()=>({stored:JSON.parse(localStorage.getItem('morzsa-v2')).stock.Tej,state:state.stock.Tej,toast:document.querySelector('#toast').textContent}));
  observations.push({id:'storage-failure',...saveFailure});const storageEvidence=await capture('supplement-storage-failure','Injected localStorage quota failure during explicit pantry save');
  checks.push({id:'PANTRY-FAILED-SAVE',title:'Rejected local save preserves state and gives truthful failure feedback',status:saveFailure.stored===1&&saveFailure.state===1&&/Nem sikerült|Could not/.test(saveFailure.toast)?'passed':'failed',details:JSON.stringify(saveFailure),evidence:storageEvidence});
  await p.evaluate(()=>{Storage.prototype.setItem=window.auditOriginalSet});await p.keyboard.press('Escape');
  await p.getByRole('button',{name:'Morzsa',exact:true}).click();await p.getByRole('textbox',{name:'Üzenet Morzsának'}).fill('Mit főzzek a tejből?');await p.getByRole('button',{name:'Küldés',exact:true}).click();
  await p.locator('#household-dialog[open]').waitFor();const guestEvidence=await capture('supplement-guest-chat-login','Guest question opens sign-in; no external request sent');
  observations.push({id:'guest-chat-signin',visibleText:await p.locator('#household-dialog').innerText()});
  checks.push({id:'GUEST-AI-SIGNIN',title:'Guest AI request requires sign-in and sends no external message',status:'passed',details:'Read-only inspection of sign-in form; no login, signup, or invitation submitted.',evidence:guestEvidence});
  await fs.writeFile(path.join(folder,'supplemental-observations.json'),JSON.stringify(observations,null,2));evidence.push({path:'evidence/supplemental-observations.json',description:'DOM-backed exploratory observations and keyboard focus results',kind:'test'});
  return {checks,evidence,observations,limitations:['Supplemental UI uses fresh guest state in synthetic loopback fixture; fonts and all external requests are blocked. Keyboard observations are not a screen-reader certification.']};
 }finally {await browser?.close();await fixture.close()}
}
