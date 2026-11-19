// Explicit, local-only sanity for the two recipe views; never contacts production.
import assert from 'node:assert/strict';
import {chromium} from '../../design-audit/node_modules/playwright/index.mjs';
const origin=process.env.MORZSA_QA_BASE||'http://127.0.0.1:8084';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local fixture required');
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1522,height:1019}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin+'/?actor=a');await page.waitForFunction(()=>window.qaCookingReady);await page.evaluate(()=>document.fonts.ready);
 const hub=page.locator('.recipe-cooking-page'),side=hub.locator('.rc-side');
 assert.equal(await hub.getAttribute('data-method-view'),'focus');assert.equal(await hub.locator('.rc-method-row.is-current').getAttribute('data-cooking-step'),'1');
 await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.screenshot({path:'design/cooking-page-2026-11-19/implementation-wide-final.png'});
 await side.locator('[data-rc-check="1"]').uncheck();await side.locator('.rc-quick-timers [data-timer-minutes="7"]').click();
 const timer=await page.locator('[data-timer-time]').getAttribute('data-timer-time');assert.ok(timer);
 await hub.locator('.rc-view-toggle [data-cooking-view="full"]').click();assert.equal(await hub.getAttribute('data-method-view'),'full');assert.equal(await side.locator('[data-rc-check="1"]').isChecked(),false);assert.equal(await page.locator('[data-timer-time]').getAttribute('data-timer-time'),timer);
 await side.locator('[data-rc-portions]').selectOption('4');assert.ok((await hub.locator('.rc-full-ingredients').innerText()).includes('160 g'));assert.ok((await hub.locator('.rc-full-ingredients').innerText()).includes('600 ml'));
 await hub.locator('.rc-view-toggle [data-cooking-view="focus"]').click();assert.equal(await hub.locator('.rc-method-row.is-current').getAttribute('data-cooking-step'),'1');assert.equal(await side.locator('[data-rc-check="1"]').isChecked(),false);assert.equal(await page.locator('[data-timer-time]').getAttribute('data-timer-time'),timer);
 await page.reload();await page.waitForFunction(()=>window.qaCookingReady);assert.equal(await side.locator('[data-rc-check="1"]').isChecked(),false);assert.equal(await side.locator('[data-rc-portions]').inputValue(),'4');assert.equal(await page.locator('[data-timer-time]').getAttribute('data-timer-time'),timer);
 // Reset the visual recipe to its reference serving count; the live timer is retained.
 await side.locator('[data-rc-portions]').selectOption('2');
 await page.setViewportSize({width:1100,height:1019});await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.screenshot({path:'design/cooking-page-2026-11-19/implementation-compact-cooking.png'});
 await hub.locator('.rc-view-toggle [data-cooking-view="full"]').click();await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.screenshot({path:'design/cooking-page-2026-11-19/implementation-compact-full.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await hub.locator('.rc-mobile-ingredients').isVisible(),true);assert.equal(await side.locator('.rc-ingredients').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await hub.locator('.rc-mobile-ingredients').click();const sheet=page.locator('#recipe-ingredients-panel');assert.equal(await sheet.getAttribute('open'),'');await sheet.locator('[data-rc-check="3"]').uncheck();await sheet.locator('[data-rc-portions]').selectOption('3');assert.equal(await sheet.locator('[data-rc-check="3"]').isChecked(),false);assert.ok((await sheet.locator('.rc-checklist').innerText()).includes('120 g'));
 await page.screenshot({path:'design/cooking-page-2026-11-19/mobile-ingredients.png'});await sheet.locator('[data-ingredients-close]').click();assert.equal(await sheet.isVisible(),false);assert.equal(await page.locator('[data-timer-time]').getAttribute('data-timer-time'),timer);
 await hub.locator('.rc-view-toggle [data-cooking-view="focus"]').click();await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.screenshot({path:'design/cooking-page-2026-11-19/mobile-cooking.png'});
 await page.setViewportSize({width:320,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await hub.locator('.rc-mobile-ingredients').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('Recipe workspace sanity passed: two views, step preservation, checklist, serving conversion, live timer across mode/reload, mobile panel, 320/390/1100/1522 layouts.');
}finally{await browser.close()}
