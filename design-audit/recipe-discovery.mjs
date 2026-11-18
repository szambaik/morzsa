// End-to-end recipe exploration against synthetic SQL records. All external traffic is blocked.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),reservation=net.createServer();
await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const origin='http://127.0.0.1:'+port,output=process.env.MORZSA_DISCOVERY_OUTPUT||path.join(root,'tmp/recipe-discovery');
fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['tests/persistence-fixture.mjs'],{cwd:root,env:{...process.env,MORZSA_QA_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let browser,context,other,logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
const results=[];
try{
 let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{ready=(await fetch(origin+'/qa/status',{signal:AbortSignal.timeout(500)})).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100))}
 assert(ready,'SQL fixture startup');
 const engine=process.env.MORZSA_DISCOVERY_BROWSER==='webkit'?'webkit':'chrome';
 browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chrome'?{channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'}:{})});
 context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 const synced=()=>page.waitForFunction(()=>MorzsaPersistence.status()==='synced');
 const idle=()=>page.waitForFunction(()=>!document.querySelector('.companion-thinking')&&!document.querySelector('.companion-pending-send'));
 await page.goto(origin+'/?actor=c');await synced();
 async function mock(){await page.evaluate(()=>{
  window.discoveryRequests=[];window.discoverySerial=0;
  household.voiceCommandStream=async(payload,onAnswer)=>{discoveryRequests.push(payload);const count=payload.context.recipeDiscovery?.action==='variant'?1:3,serial=++discoverySerial;onAnswer('Három könnyen elkészíthető ötlet.');return {transcript:payload.text,answer:'Ötletek a kérésed alapján.',clarification:'',operations:[],recipes:Array.from({length:count},(_,i)=>({title:'Zöldséges rizs '+serial+'-'+i,summary:'Gyors, zöldséges vacsora.',minutes:25,servings:2,equipment:['Fedeles lábas'],ingredients:[{name:'Rizs',amount:'150 g'},{name:'Sárgarépa',amount:'1 db'},{name:'Só',amount:'fél tk'}],steps:['Főzd meg a rizst a csomagolás szerint.','Pirítsd a répát, majd keverd a rizshez.']}))}};
 })}
 await mock();
 await page.evaluate(()=>MorzsaCompanion.ask('Két főre kérek vacsorát, hús nélkül, legfeljebb 30 perc alatt.'));
 await page.locator('.companion-recipe').nth(2).waitFor();await idle();await synced();
 assert.equal(await page.locator('.companion-recipe').count(),3);
 const chat=await page.evaluate(()=>{const key=PersistenceModel.accountKey(household.userId());return JSON.parse(localStorage.getItem(key)).active});
 await page.locator('[data-more-ideas]').click();await page.waitForFunction(()=>discoveryRequests.length===2);await idle();await synced();
 let request=await page.evaluate(()=>discoveryRequests.at(-1));assert.match(request.context.recipeDiscovery.request,/Két főre/);assert.equal(request.context.recipeDiscovery.action,'more');assert.equal(request.context.recipeDiscovery.excludeTitles.length,3);assert.equal(await page.locator('.companion-recipe').count(),6);
 results.push('Three alternatives and retained original request');
 await page.locator('.recipe-idea-tools summary').click();
 await page.locator('[name=refinement][value=less_cleanup]').check();await page.locator('[name=refinement][value=cheap]').check();await page.locator('[name=refinement][value=more_vegetables]').check();
 await page.locator('[data-refine-ideas] button').click();await page.waitForFunction(()=>discoveryRequests.length===3);await idle();await synced();
 request=await page.evaluate(()=>discoveryRequests.at(-1));assert.deepEqual(request.context.recipeDiscovery.refinements,['less_cleanup','cheap','more_vegetables']);
 const meta=await page.evaluate(async id=>(await household.dataRpc('conversation_index',{},true)).find(t=>t.id===id).metadata,chat);assert.equal(meta.recipeDiscovery.refinements.length,3);
 await page.reload();await synced();await mock();await page.locator('[data-more-ideas]').click();await page.waitForFunction(()=>discoveryRequests.length===1);await idle();await synced();
 assert.deepEqual((await page.evaluate(()=>discoveryRequests.at(-1))).context.recipeDiscovery.refinements,['less_cleanup','cheap','more_vegetables']);
 results.push('Refinements survive SQL sync and reload');
 // Every control remains usable at phone and desktop sizes.
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow at '+width)}
 await page.setViewportSize({width:390,height:844});await page.locator('.recipe-idea-tools').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,engine+'-alternatives.png')});
 const firstTitle=await page.locator('.companion-recipe h3').first().textContent();
 await page.locator('.companion-recipe .recipe-variants summary').first().click();await page.locator('[data-chat-variant-0=quick]').click();
 await page.waitForFunction(()=>discoveryRequests.length===2);await idle();await synced();request=await page.evaluate(()=>discoveryRequests.at(-1));
 assert.equal(request.context.recipeDiscovery.action,'variant');assert.equal(request.context.recipeDiscovery.variant,'quick');assert.equal(request.context.recipeDiscovery.sourceRecipe.title,firstTitle);assert.equal(await page.locator('.companion-recipe').count(),1);
 results.push('Variation creates a separate conversation for the same dish');
 // Start from a selected pantry item; add a second ingredient before requesting recipes.
 await page.evaluate(async()=>{state.stock.Rizs=2;state.stock.Sárgarépa=2;await saveVoiceState(state);page='pantry';render();openPantryDetails('Rizs')});
 const before=await page.evaluate(()=>JSON.stringify({stock:state.stock,cart:state.cart}));
 await page.locator('[data-pantry-cook]').click();assert.equal(await page.locator('[data-craft-remove=Rizs]').count(),1);
 await page.locator('#craft-search').fill('répa');await page.locator('[data-craft-item=Sárgarépa]').click();await page.locator('#craft-discover').click();await page.waitForFunction(()=>discoveryRequests.length===3);await idle();await synced();
 request=await page.evaluate(()=>discoveryRequests.at(-1));assert.match(request.text,/Rizs/);assert.match(request.text,/Sárgarépa/);assert.equal(request.context.recipeDiscovery.sourceRecipe,undefined);
 assert.equal(await page.evaluate(()=>JSON.stringify({stock:state.stock,cart:state.cart})),before);results.push('Ingredient selection leaves stock and shopping list unchanged');
 const source=await page.evaluate(()=>{const book=JSON.parse(localStorage.getItem(PersistenceModel.accountKey(household.userId())));return book.threads.find(t=>t.id===book.active).messages.filter(m=>m.recipes?.length).at(-1).recipes[0]});
 await page.evaluate(r=>MorzsaCompanion.discuss(r),source);await synced();
 await page.locator('.cooking-hero [data-portions-target]').fill('5');await page.locator('.cooking-hero [data-portions-target]').dispatchEvent('change');await synced();
 await page.locator('.cooking-task-dock [data-begin-cooking]').click();await page.locator('.cooking-task-dock [data-complete-step]').click();await page.locator('.cooking-task-dock [data-complete-step]').click();await synced();
 await page.locator('.cooking-optional-feedback summary').click();await page.locator('[name=feedback-signal][value=tasty]').check();await page.locator('[name=feedback-signal][value=too_slow]').check();
 await page.locator('[name=notes]').fill('Legközelebb több kömény.');await page.locator('[data-cooking-feedback] button').click();await synced();
 assert.match(await page.locator('[data-feedback-saved]').textContent(),/mentve/);
 const cooked=await page.evaluate(()=>MorzsaCompanion.recipeThreads().find(t=>t.status==='completed'));assert.deepEqual(cooked.cooking.feedback.signals,['tasty','too_slow']);
 await page.locator('.cooking-task-dock [data-cook-again]').click();await synced();assert.equal(await page.locator('.cooking-hero [data-portions-target]').inputValue(),'5');
 assert.equal(await page.locator('[data-begin-cooking]').count(),2);assert.equal(await page.evaluate(()=>MorzsaCompanion.recipeThreads().filter(t=>t.status==='completed').length),1);
 results.push('Cook again retains five portions and the previous completed recipe');
 await page.evaluate(()=>MorzsaCompanion.newChat());await page.evaluate(()=>MorzsaCompanion.ask('Mit főzzek ma?'));await page.waitForFunction(()=>discoveryRequests.length===4);await idle();await synced();
 request=await page.evaluate(()=>discoveryRequests.at(-1));assert.equal(request.context.recipeFeedback[0].title,cooked.recipe.title);assert.deepEqual(request.context.recipeFeedback[0].signals,['tasty','too_slow']);assert.match(request.context.recipeFeedback[0].notes,/kömény/);
 results.push('Saved feedback reaches future recommendation requests');
 await page.evaluate(r=>RecipeRoom.open(r),cooked.recipe);assert.equal(await page.locator('[data-portions-target]').inputValue(),'5');
 await page.locator('.recipe-reading-detail .recipe-variants summary').click();await page.locator('[data-recipe-variant=healthy]').click();await page.waitForFunction(()=>discoveryRequests.length===5);await idle();await synced();
 request=await page.evaluate(()=>discoveryRequests.at(-1));assert.equal(request.context.recipeDiscovery.variant,'healthy');assert.equal(request.context.recipeDiscovery.sourceRecipe.servings,5);assert.equal(request.context.recipeDiscovery.sourceRecipe.title,cooked.recipe.title);
 results.push('Saved recipe variations use the previous portion setting');
 // A later dietary correction must survive moving to a separate variation chat.
 await page.evaluate(()=>MorzsaCompanion.ask('Végül tejtermék nélkül kérem, az adag és a többi igény maradjon.'));await page.waitForFunction(()=>discoveryRequests.length===6);await idle();await synced();
 await page.locator('.companion-recipe .recipe-variants summary').last().click();await page.locator('[data-chat-variant-3=cheap]').click();await page.waitForFunction(()=>discoveryRequests.length===7);await idle();await synced();
 request=await page.evaluate(()=>discoveryRequests.at(-1));assert.equal(request.context.recipeDiscovery.variant,'cheap');assert.match(request.context.recipeDiscovery.followUps.at(-1),/tejtermék nélkül/);
 results.push('Later dietary corrections survive a separate recipe variation');
 await page.screenshot({path:path.join(output,engine+'-feedback-recommendations.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 fs.writeFileSync(path.join(output,engine+'-results.json'),JSON.stringify({passed:true,results,errors},null,2));console.log('Recipe discovery browser regressions passed: '+results.length+' journeys ('+engine+').');
}catch(error){if(context){const p=context.pages()[0];if(p){await p.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error((await p.locator('body').innerText()).slice(-2500))}}throw error}
finally{await other?.close();await context?.close();await browser?.close();server.kill('SIGTERM')}
