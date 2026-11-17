// Browser regression uses an isolated database and blocks all external traffic.
import {chromium} from 'playwright';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {startFixture,actors} from './performance/fixture.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(import.meta.dirname,'runs','recipe-latency-'+new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(out,{recursive:true});
const fixture=await startFixture({repoRoot:root}),origin=fixture.origin,browser=await chromium.launch({headless:true,channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome',args:['--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost']});
const result={labOnly:true,checks:[],errors:[],timings:[]},recipe={title:'Almás palacsinta',summary:'Két főre, serpenyőben.',minutes:25,servings:2,equipment:['Serpenyő'],ingredients:[{name:'Alma',amount:'2 db'},{name:'Tojás',amount:'2 db'}],steps:['1. Készítsd elő a hozzávalókat.\n2. Süsd át a palacsintát.'],stepTitles:['Palacsinta sütése']},output={answer:'Próbáld ezt az almás palacsintát.',transcript:'Adj egy almás receptet.',recipes:[recipe],operations:[],clarification:''};
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await ctx.routeWebSocket('**/*',ws=>ws.close());
 await ctx.addInitScript(({id})=>{localStorage.setItem('morzsa-introduction-v1','done');localStorage.setItem('morzsa-ai-mode','plus');localStorage.setItem('morzsa-session',JSON.stringify({access_token:'audit-c',expires_at:9999999999,user:{id,email:'c@audit.invalid'}}))},{id:actors.c});
 await ctx.tracing.start({screenshots:true,snapshots:true});const p=await ctx.newPage();p.on('pageerror',e=>result.errors.push(e.message));p.on('console',m=>{if(m.text().includes('morzsa_chat_timing'))result.timings.push(JSON.parse(m.text()))});
 await p.goto(origin);await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');await p.evaluate(()=>MorzsaCompanion.newChat());await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
 const preview={type:'recipe_preview',recipes:[{title:recipe.title,summary:recipe.summary,minutes:recipe.minutes,servings:2}]};
 fixture.ai.push({stream:[output.answer,preview],interval:2000,output});const from=fixture.calls.length,started=performance.now();
 await p.locator('#companion-input').fill(output.transcript);await p.locator('#companion-form').evaluate(el=>el.requestSubmit());
 await p.locator('[data-stream-recipes] h3').waitFor();result.firstCardMs=performance.now()-started;
 assert.equal(await p.locator('[data-stream-recipes] h3').textContent(),recipe.title);assert.equal(await p.locator('[data-stream-recipes] button').count(),0);
 assert.equal(await p.locator('[data-view-recipe]').count(),0);assert.equal(fixture.calls.slice(from).some(c=>c.path.includes('/save_recipe_document')),false);result.checks.push('Preview before completion without saves, image generation or cooking actions');
 for(const width of [320,390,1280]){await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:path.join(out,'preview-'+width+'.png')})}
 await p.locator('[data-view-recipe]').waitFor();result.completeCardMs=performance.now()-started;assert.equal(await p.locator('[data-stream-recipes]').count(),0);result.checks.push('Validated final recipe replaces preview');
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(out,'complete.png')});await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
 // Cancellation discards the preview and retry starts with an empty display.
 await p.evaluate(()=>MorzsaCompanion.newChat());await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');fixture.ai.push({stream:[preview],interval:3500,output});
 await p.locator('#companion-input').fill(output.transcript);await p.locator('#companion-form').evaluate(el=>el.requestSubmit());await p.locator('[data-stream-recipes] h3').waitFor();await p.waitForTimeout(450);await p.locator('[data-action=stop]').click();
 await p.locator('[data-retry]').waitFor();assert.equal(await p.locator('[data-stream-recipes]').count(),0);assert.equal(await p.locator('[data-view-recipe]').count(),0);result.checks.push('Stop removes incomplete cards');
 fixture.ai.push({stream:[output.answer],interval:400,output});await p.locator('[data-retry]').click();await p.locator('[data-view-recipe]').waitFor();assert.equal(await p.locator('[data-view-recipe]').count(),1);result.checks.push('Retry produces exactly one complete card');
 // Invalid final output never promotes a preview to a saved recipe.
 await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');await p.evaluate(()=>MorzsaCompanion.newChat());await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');fixture.ai.push({stream:[preview],interval:400,output:{...output,recipes:[{...recipe,steps:[]}]}});
 await p.locator('#companion-input').fill(output.transcript);await p.locator('#companion-form').evaluate(el=>el.requestSubmit());await p.locator('[data-action=stop]').waitFor();await p.locator('[data-action=send]').waitFor();assert.equal(await p.locator('[data-view-recipe]').count(),0);assert.equal(await p.locator('[data-stream-recipes]').count(),0);result.checks.push('Invalid final recipe discards preview');
 assert.deepEqual(result.errors,[]);await ctx.tracing.stop({path:path.join(out,'trace.zip')});await ctx.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({out,...result},null,2));
}finally{await browser.close();await fixture.close()}
