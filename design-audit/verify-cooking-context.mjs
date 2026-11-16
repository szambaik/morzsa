import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {auditContext} from './browser.mjs';
import {startFixture} from './fixture.mjs';

export async function verifyCookingContext({repoRoot=path.resolve(import.meta.dirname,'..'),outputDir}){
 fs.mkdirSync(outputDir,{recursive:false});const fixture=await startFixture({repoRoot});let browser;
 try {
  browser=await chromium.launch({headless:true,channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'});
  const {context}=await auditContext(browser,fixture.origin);const p=await context.newPage();p.setDefaultTimeout(8000);
  await p.goto(fixture.origin);await p.waitForFunction(()=>window.RecipeRoom&&MorzsaPersistence.status()==='synced');
  await p.evaluate(()=>RecipeRoom.open({title:'Audit blansírozott alma',summary:'Szintetikus ellenőrzés.',servings:2,minutes:10,ingredients:[{name:'Alma',amount:'2 db'}],stepTitles:['Blansírozás','Tálalás'],steps:['Blansírozd az almát.','Tálald az almát.']}));
  await p.locator('[data-start-cooking]').click();await p.locator('.cooking-task-dock [data-begin-cooking]').click();
  await p.locator('[data-open-cooking-question]').click();
  fixture.ai.push({output:{answer:'Röviden tedd forró vízbe az almát, majd hűtsd le.',operations:[],clarification:'',recipes:[],transcript:''}});
  const question='Mit jelent ebben a lépésben a blansírozás?';await p.locator('#companion-input').fill(question);
  const sent=p.waitForRequest(r=>r.method()==='POST'&&r.url().includes('/functions/')&&r.postDataJSON()?.text===question);
  await p.locator('#companion-input').press('Enter');const request=(await sent).postDataJSON();
  await p.waitForFunction(()=>!document.querySelector('.companion-thinking')&&document.body.innerText.includes('Röviden tedd forró vízbe'));
  await p.screenshot({path:path.join(outputDir,'cooking-answer.png'),animations:'disabled'});
  fs.writeFileSync(path.join(outputDir,'cooking-answer.txt'),await p.locator('body').ariaSnapshot());
  await p.locator('[data-close-question]').click();
  const returned=await p.locator('#cooking-step-0').isVisible();
  const result={request,checks:[
   {id:'E-CONTEXTUAL-AI',title:'Cooking question sends current recipe and step through HTTP fixture',status:request.context?.cookingRecipe?.title==='Audit blansírozott alma'&&request.context.cookingStep===0?'passed':'failed'},
   {id:'E-AI-RETURN',title:'Returning from contextual answer preserves active cooking step',status:returned?'passed':'failed'}
  ],limitations:['Answer is an explicit canned HTTP fixture; live culinary accuracy is not tested.']};
  fs.writeFileSync(path.join(outputDir,'results.json'),JSON.stringify(result,null,2));return result;
 }finally{await browser?.close();await fixture.close()}
}
if(process.argv[1]===import.meta.filename){const r=await verifyCookingContext({outputDir:path.resolve(process.argv[2])});console.log(JSON.stringify(r.checks,null,2));process.exitCode=r.checks.some(c=>c.status==='failed')?2:0;}
