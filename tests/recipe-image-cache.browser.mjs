// Start tests/persistence-fixture.mjs with MORZSA_QA_PORT=8942 and MORZSA_QA_PROACTIVE=1.
// Network access is restricted to that local SQL fixture; image generation is mocked.
import {chromium} from '../design-audit/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';
const out=new URL('../design/recipe-image-cache-2026-11-17',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],cached=new Map(),requests=[];
p.on('pageerror',e=>errors.push(e.message));
await ctx.route('**/*',async route=>{
 const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
 if(u.pathname==='/functions/v1/recipe-image'){
  const body=route.request().postDataJSON(),key=body.recipeId+'|'+body.step;requests.push(body);
  if(body.create&&!cached.has(key))cached.set(key,{generations:1,url:'http://127.0.0.1:8942/storage/v1/object/sign/recipe-images/'+body.recipeId+'/'+body.step+'.jpg'});
  return route.fulfill({status:200,json:cached.has(key)?{status:'ready',url:cached.get(key).url,expiresAt:Date.now()+1700000}:{status:'missing'}});
 }
 return route.continue();
});
const settled=()=>p.waitForFunction(()=>MorzsaPersistence.status()==='synced'&&!household.busy&&!document.querySelector('.companion-thinking'));
try{
 await p.goto('http://127.0.0.1:8942/?actor=c');await settled();
 await p.evaluate(()=>{AIMode.set('free');MorzsaCompanion.newChat();household.voiceCommandStream=async(payload,cb)=>{cb('Íme a próbarecept.');return {transcript:payload.text,answer:'Íme a próbarecept.',operations:[],clarification:'',recipes:[{title:'Egyszerű próbarecept',summary:'Három egyszerű előkészítő lépés.',minutes:15,servings:2,ingredients:[{name:'Liszt',amount:'100 g'},{name:'Víz',amount:'200 ml'}],steps:['Mérd ki a lisztet egy tálba.','Öntsd hozzá a vizet.','Pihentesd tíz percig.'],stepTitles:['Liszt kimérése','Víz hozzáadása','Pihentetés']}]}}});
 await p.locator('#companion-input').fill('Kérek egy receptet');await p.locator('#companion-input').press('Enter');await settled();
 await p.locator('.companion-recipe .generated-recipe-image img').last().waitFor();assert.equal(cached.size,1);
 const book=await p.evaluate(()=>JSON.parse(localStorage.getItem(PersistenceModel.accountKey(household.userId()))));
 const recipe=book.threads.flatMap(t=>t.messages).flatMap(m=>m.recipes||[]).find(r=>r.title==='Egyszerű próbarecept');assert.ok(recipe.recipeId);
 // Old conversation replay has no new-answer enqueue call. It must still fill a missing cover.
 cached.clear();requests.length=0;await p.reload();await settled();await p.locator('.companion-recipe .generated-recipe-image img').last().waitFor();assert.equal(cached.size,1);assert.equal(requests.some(r=>r.create&&r.step===-1),true);
 await p.locator('[data-view-recipe]').last().click();await p.locator('.recipe-reading-detail').waitFor();
 for(let i=0;i<3;i++){
  const step=p.locator('.recipe-method > ol > li').nth(i);await step.evaluate(el=>el.scrollIntoView({block:'center'}));await step.locator('.generated-recipe-image img').waitFor();
 }
 assert.equal(cached.size,4);for(const step of [-1,0,1,2])assert.ok(cached.has(recipe.recipeId+'|'+step));
 const before=JSON.stringify([...cached]);await p.reload();await settled();await p.evaluate(r=>RecipeRoom.open(r),recipe);
 for(let i=0;i<3;i++){const step=p.locator('.recipe-method > ol > li').nth(i);await step.evaluate(el=>el.scrollIntoView({block:'center'}));await step.locator('.generated-recipe-image img').waitFor()}
 assert.equal(JSON.stringify([...cached]),before);assert.equal(requests.every(r=>r.quality==='free'),true);
 // Library cards also ensure a backend image without showing a manual generation button.
 await p.locator('[data-reading-back]').click();await p.locator('[data-feed-tab=browse]').click();await p.locator('.recipe-feed-grid .room-card').first().waitFor();await p.locator('.recipe-feed-grid .room-card').first().evaluate(el=>el.scrollIntoView({block:'center'}));await p.locator('.recipe-feed-grid .room-card .room-image-cache img').first().waitFor();
 assert.equal(await p.locator('.recipe-feed-grid .room-card .room-image-cache button').count(),0);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 const results={oldChatAutoCover:true,freeModeAllSteps:true,cachedRecipeAssets:[-1,0,1,2].map(step=>({step,...cached.get(recipe.recipeId+'|'+step)})),reloadReusesCache:true,libraryAutoCover:true,manualImageButtons:0,errors};
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));await p.screenshot({path:out+'/library-auto-images.png',fullPage:false});console.log(JSON.stringify(results));
}finally{await ctx.close();await browser.close()}
