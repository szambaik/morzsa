// Real SQL-backed local fixture. Every external request is blocked; no production data or paid AI.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),port=Number(process.env.MORZSA_DYNAMIC_PORT)||8872;
const origin='http://127.0.0.1:'+port,output=process.env.MORZSA_DYNAMIC_OUTPUT||path.join(root,'tmp/dynamic-recipe');fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['tests/persistence-fixture.mjs'],{cwd:root,env:{...process.env,MORZSA_QA_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Fixture startup timeout')),15000);server.stdout.on('data',d=>{if(String(d).includes('Persistent UI fixture')){clearTimeout(timeout);resolve()}});server.on('exit',code=>{clearTimeout(timeout);reject(Error('Fixture exited '+code))});server.stderr.on('data',d=>process.stderr.write(d))});
 const engine=process.env.MORZSA_DYNAMIC_BROWSER==='webkit'?'webkit':'chrome';
 browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chrome'?{channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),errors=[];
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.stack||e.message));
 const synced=()=>p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
 await p.goto(origin+'/?actor=c');await synced();
 await p.evaluate(async()=>{
  state.stock.Rizs=1;state.stock.Só=0;delete state.stock.Alma;await saveVoiceState(state);
  window.qaRecipe=await MorzsaPersistence.ensureRecipe({title:'Fűszeres rizs',summary:'Illatos, egyszerű köret.',servings:3,difficulty:'easy',preparationTips:['Öblítsd át a rizst, mielőtt főzni kezded.'],equipment:['Fedeles lábas'],minutes:20,ingredients:[{name:'Rizs',amount:'150 g'},{name:'Só',amount:'½ tk'},{name:'Alma',amount:'1 db'}],stepTitles:['A rizs előkészítése','Pihentetés és tálalás'],steps:['1. Öblíts át 150 g rizst.\n2. Tedd lábasba és főzd a csomagolás szerint.\nFontos: Ne keverd folyamatosan.','Pihentesd 5 percig fedő alatt.']});MorzsaCompanion.discuss(qaRecipe);
 });
 await p.locator('[data-equipment-ready]').check();await synced();
 await p.locator('[data-portions-target]').fill('1');await p.locator('[data-portions-target]').dispatchEvent('change');
 assert.equal(await p.locator('.recipe-needed').nth(1).textContent(),'1/6 tk');assert.equal(await p.locator('[data-availability="unknown"]').count(),1);
 await p.locator('[data-recipe-missing]').click();assert.equal(await p.locator('.ingredient-batch-preview>p').count(),3);assert.equal(await p.evaluate(()=>state.cart.length),0);
 await p.locator('[data-recipe-missing]').click();assert.deepEqual(await p.evaluate(()=>state.cart.map(i=>i.name).sort()),['Rizs','Só']);
 await p.screenshot({path:path.join(output,engine+'-preparation.png'),fullPage:true});
 await p.locator('.cooking-task-dock [data-begin-cooking]').click();await synced();
 assert.match(await p.locator('#cooking-step-0').textContent(),/50 g/);assert.equal(await p.locator('[data-cooking-step]:visible').count(),1);
 await p.locator('.cooking-timer-tools>summary').click();await p.locator('[data-custom-timer] button').click();
 await p.locator('[data-timer-action="pause"]').click();await synced();const paused=await p.locator('[data-timer-time]').textContent();
 await p.locator('.cooking-task-dock [data-pause-cooking]').click();await synced();assert.equal(await p.locator('.cooking-task-dock [data-complete-step]').isDisabled(),true);
 const id=await p.evaluate(()=>MorzsaCompanion.recipeThreads().find(t=>t.recipe.title===qaRecipe.title).id);
 await p.reload();await synced();await p.evaluate(id=>MorzsaCompanion.openThread(id),id);
 assert.equal(await p.locator('[data-timer-time]').textContent(),paused);assert.equal(await p.locator('.cooking-paused').count(),1);
 await context.setOffline(true);await p.locator('.cooking-task-dock [data-pause-cooking]').click();await p.locator('[data-timer-action="reset"]').click();assert.equal(await p.locator('[data-timer-time]').textContent(),'5:00');
 await p.locator('[data-timer-action="resume"]').click();assert.match(await p.locator('[data-cooking-save-state]').textContent(),/eszközön/);await context.setOffline(false);await synced();
 await p.evaluate(()=>{household.voiceCommandStream=async(payload,onAnswer)=>{qaChatRequests.push(payload);onAnswer('Kisebb lángon folytasd.');return {answer:'Kisebb lángon folytasd.',transcript:payload.text,clarification:'',recipes:[],operations:[],cookingUI:{version:1,step:payload.context.cookingStep,components:[{type:'tip_card',title:'Kíméletes főzés',text:'A csomag főzési idejét kövesd; a rizs fajtája is számít.'},{type:'ingredient_checklist',title:'Ehhez az adaghoz',indices:[0,1]}]}}}});
 await p.locator('[data-open-cooking-question]').click();await p.locator('[data-cooking-help="tip"]').click();await p.locator('#companion-form').evaluate(f=>f.requestSubmit());await p.waitForFunction(()=>!document.querySelector('.companion-thinking'));await synced();
 assert.equal(await p.locator('.cooking-help-context').isVisible(),true);await p.waitForFunction(()=>{const e=document.querySelector('.cooking-help-context');return e&&getComputedStyle(e.parentElement).position==='static'});
 assert.equal(await p.locator('.cooking-help-context + .cooking-guidance [data-guidance-type]').count(),2);
 assert.equal(await p.evaluate(()=>qaChatRequests.at(-1).context.cookingSession.timers[0].paused),false);
 for(const width of [320,375,390,430,768,1280]){
  await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow at '+width);
  const box=await p.locator('#companion-form').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,'composer at '+width);
  if(width===1280)assert((await p.locator('.cooking-help-context').boundingBox()).width>=400,'desktop context width');
  await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.screenshot({path:path.join(output,engine+'-help-'+width+'.png'),fullPage:true});
 }
 await p.setViewportSize({width:390,height:844});await p.locator('[data-close-question]').click();assert.equal(await p.locator('[data-open-cooking-question]').evaluate(e=>e===document.activeElement),true);
 await p.screenshot({path:path.join(output,engine+'-cooking.png'),fullPage:true});
 // Invalid structured content degrades to the useful answer, without changing stock or progress.
 await p.evaluate(()=>{household.voiceCommandStream=async p=>({answer:'Ellenőrizd a csomagolást.',transcript:p.text,clarification:'',recipes:[],operations:[],cookingUI:{version:1,step:0,components:[{type:'execute',text:'delete pantry'}]}})});
 await p.locator('[data-open-cooking-question]').click();await p.locator('#companion-input').fill('És most?');await p.locator('#companion-form').evaluate(f=>f.requestSubmit());await p.waitForFunction(()=>!document.querySelector('.companion-thinking'));await synced();
 assert.equal(await p.evaluate(()=>state.stock.Rizs),1);
 await p.locator('[data-close-question]').click();await p.locator('.cooking-task-dock [data-complete-step]').click();assert.equal(await p.locator('.cooking-guidance').count(),0);
 await p.locator('.cooking-task-dock [data-complete-step]').click();await p.locator('.cooking-optional-feedback>summary').click();await p.locator('[name="leftoverPortions"]').fill('1');await p.locator('[data-cooking-feedback] button').click();await synced();
 const other=await context.newPage();await other.goto(origin+'/?actor=c');await other.waitForFunction(()=>MorzsaPersistence.status()==='synced');await other.evaluate(id=>MorzsaCompanion.openThread(id),id);assert.equal(await other.locator('[name="leftoverPortions"]').inputValue(),'1');
 // A legacy recipe with no serving count stays readable and asks for its base before starting.
 await p.evaluate(()=>MorzsaCompanion.discuss({title:'Régi recept',summary:'Régi mentés.',minutes:10,ingredients:[{name:'Rizs',amount:'100 g'}],steps:['Főzd meg.']}));
 assert.equal(await p.locator('.cooking-task-dock [data-begin-cooking]').isDisabled(),true);await p.locator('[data-portions-base]').selectOption('2');assert.equal(await p.locator('.cooking-task-dock [data-begin-cooking]').isEnabled(),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,engine,widths:[320,375,390,430,768,1280],checks:['low versus unknown','fractional portions','approved shopping','equipment','timer pause/resume/reset','session pause and reload','offline controls and sync recovery','contextual AI cards','invalid UI fallback','focus return','completion','cross-device leftovers','legacy serving guard'],output}));
}finally{await browser?.close();server.kill('SIGTERM')}
