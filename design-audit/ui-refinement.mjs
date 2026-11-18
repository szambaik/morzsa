import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {startFixture} from './fixture.mjs';
import {auditContext} from './browser.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'docs/evidence/ios-layout-chat-timing-2026-11-18');
fs.mkdirSync(out,{recursive:true});const fixture=await startFixture({repoRoot:root}),results=[];
const recipe={title:'Próba paradicsomos tojás',summary:'Egyszerű vacsora két főre.',minutes:20,servings:2,ingredients:[{name:'Tojás',amount:'2 db'},{name:'Paradicsom',amount:'2 db'}],steps:['Készítsd elő a hozzávalókat.','Süsd át a tojást.'],stepTitles:['Előkészítés','Sütés']};
try{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(name==='chromium'?{channel:'chrome',headless:true}:{headless:true});
  try{for(const width of [320,390,1366]){
   const {context}=await auditContext(browser,fixture.origin,{viewport:{width,height:844}}),p=await context.newPage();
   try{
    await p.goto(fixture.origin);await p.waitForFunction(()=>window.MorzsaCompanion&&MorzsaPersistence.status()==='synced');
    await p.addStyleTag({content:fs.readFileSync(path.join(root,'mobile/ios.css'),'utf8')});
    if(width<1000)await p.evaluate(()=>document.documentElement.classList.add('native-app','native-ios'));
    await p.locator('nav [data-page=recipes]').evaluate(el=>el.click());
    await p.locator('[data-feed-tab=browse]').click();await p.locator('.recipe-feed-search').waitFor();
    assert.equal(await p.locator('.recipe-filter-menu[open]').count(),0);
    assert.equal(await p.locator('.recipe-library>.room-heading,.recipe-library>.pantry-intro').count(),0);
    await p.locator('.recipe-filter-menu>summary').click();await p.locator('[data-feed-tag="édes"]').click();
    await p.waitForFunction(()=>document.querySelector('.recipe-filter-menu>summary[data-filter-active]'));
    await p.locator('.recipe-filter-menu>summary').click();await p.locator('[data-feed-tag=""]').click();
    await p.waitForFunction(()=>!document.querySelector('.recipe-filter-menu>summary[data-filter-active]'));
    await p.waitForFunction(()=>document.querySelector('.recipe-feed-grid .room-card'));
    const geometry=await p.evaluate(()=>{
     const header=document.querySelector('.app>header'),a=document.getElementById('workspace-quick-add').getBoundingClientRect(),b=document.getElementById('workspace-new-chat').getBoundingClientRect(),art=document.querySelector('.feed-card-art').getBoundingClientRect();
     return {overflow:document.documentElement.scrollWidth>innerWidth,plus:a.toJSON(),newChat:b.toJSON(),header:header.getBoundingClientRect().toJSON(),ratio:art.width/art.height,tabsFirst:document.querySelector('.recipe-library').firstElementChild.matches('.recipe-feed-tabs')};
    });
    assert.equal(geometry.overflow,false);assert(geometry.tabsFirst);assert(Math.abs(geometry.ratio-16/9)<.04);
    if(width<1000){assert(geometry.plus.right<=geometry.newChat.left);assert(Math.abs(geometry.plus.top-geometry.newChat.top)<2);assert(geometry.newChat.bottom<=geometry.header.bottom+1)}
    await p.screenshot({path:path.join(out,name+'-recipes-'+width+'.png')});
    await p.evaluate(r=>MorzsaCompanion.discuss(r),recipe);await p.locator('.cooking-preparation').waitFor();
    assert.equal(await p.locator('.companion-back-main img[src$="arrow-left.svg"]').count(),1);
    assert.equal(await p.locator('.companion-back-main').innerText(),'');
    if(width>=1000){const boxes=await p.evaluate(()=>({hero:document.querySelector('.cooking-hero').getBoundingClientRect().toJSON(),prep:document.querySelector('.cooking-preparation').getBoundingClientRect().toJSON()}));assert(boxes.prep.x>=boxes.hero.right-1);assert(boxes.hero.width>350)}
    await p.screenshot({path:path.join(out,name+'-cooking-'+width+'.png')});
    await p.evaluate(r=>RecipeRoom.open(r),recipe);await p.locator('.recipe-reading-detail').waitFor();
    if(width>=1000){const boxes=await p.evaluate(()=>({hero:document.querySelector('.recipe-reading-hero').getBoundingClientRect().toJSON(),detail:document.querySelector('.recipe-reading-detail').getBoundingClientRect().toJSON()}));assert(boxes.detail.x>=boxes.hero.right)}
    await p.screenshot({path:path.join(out,name+'-reading-'+width+'.png')});
    await p.locator('nav [data-page=chat]').evaluate(el=>el.click());
    await p.evaluate(()=>MorzsaCompanion.newChat());
    await p.locator('#companion-input').fill('Kérdésem van');
    const color=await p.locator('#companion-form [type=submit]').evaluate(el=>getComputedStyle(el).backgroundColor);assert.equal(color,'rgb(191, 78, 44)');
    results.push({engine:name,width,status:'passed',...geometry});
   }finally{await context.close()}
  }}finally{await browser.close()}
 }
 console.log(JSON.stringify(results,null,2));
}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));await fixture.close()}
