// Run with the isolated persistence fixture on port 8948, collaboration enabled.
import {chromium} from '../design-audit/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8948',browser=await chromium.launch({headless:true,channel:'chrome'}),ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),errors=[];let delay=false,deny=false,reads=0;
p.on('pageerror',e=>errors.push(e.message));
await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();if(deny&&(u.pathname==='/rest/v1/households'||u.pathname==='/rest/v1/rpc/household_recipe_index'))return route.fulfill({status:403,json:{message:'Household access denied'}});if(delay&&u.pathname.startsWith('/rest/')){reads++;await new Promise(r=>setTimeout(r,1600))}return route.continue()});
try{
 await p.goto(base+'/?actor=a');await p.waitForFunction(()=>household.active&&!household.busy);
 await p.evaluate(async()=>{await household.dataRpc('apply_household_changes',{hid:household.active,changes:[{bucket:'stock',key:'Tej',value:2,expected:household.rows.find(r=>r.bucket==='stock'&&r.key==='Tej')?.revision||0},{bucket:'cart',key:'Alma',value:{name:'Alma',quantity:2,done:false},expected:household.rows.find(r=>r.bucket==='cart'&&r.key==='Alma')?.revision||0}]})});
 await p.reload();await p.waitForFunction(()=>household.active&&!household.busy&&state.stock.Tej===2&&state.cart.some(i=>i.name==='Alma'));
 await p.evaluate(()=>{page='recipes';render()});await p.waitForFunction(()=>RecipeLibrary.overview()?.entries.length>0&&!RecipeLibrary.overview()?.loading);
 await p.evaluate(async()=>{window.qaRecipe=await RecipeLibrary.get(RecipeLibrary.overview().entries[0].id);await RecipeLibrary.save(qaRecipe,true);await MorzsaCache.image(MorzsaCache.current(),MORZSA_CLOUD.url+'/storage/v1/object/sign/recipe-images/cache-test.jpg?token=one')});
 await p.waitForTimeout(300);
 // Reload immediately paints household pantry/cart and recipe feed before a 1.6s read.
 delay=true;reads=0;await p.reload();const started=Date.now();
 await p.waitForFunction(()=>household.active&&state.stock.Tej===2&&state.cart.some(i=>i.name==='Alma'),{},{timeout:1000});
 const paintMs=Date.now()-started;assert.ok(paintMs<1000,'cached kitchen beats delayed server');assert.equal(await p.evaluate(()=>household.busy),true,'authoritative refresh still running');
 await p.evaluate(()=>{page='recipes';render()});await p.waitForFunction(()=>RecipeLibrary.overview()?.entries.length>0,{},{timeout:1000});
 await p.waitForFunction(()=>RecipeLibrary.overview()?.library.some(r=>r.ownFavourite),{},{timeout:1000});
 await p.waitForFunction(()=>!household.busy,{},{timeout:10000});assert.ok(reads>0,'background refresh occurred');
 // Same asset with a renewed signature reuses persisted Blob, including offline.
 const assets=await p.evaluate(async()=>{const original=window.fetch;let fetches=0;window.fetch=async(...args)=>{if(String(args[0]).includes('cache-test.jpg')){fetches++;throw Error('offline')}return original(...args)};try{const url=await MorzsaCache.image(MorzsaCache.current(),MORZSA_CLOUD.url+'/storage/v1/object/sign/recipe-images/cache-test.jpg?token=two');return {blob:url.startsWith('blob:'),fetches}}finally{window.fetch=original}});assert.deepEqual(assets,{blob:true,fetches:0});
 // A cached document opens while its revalidation is still delayed.
 const documentMs=await p.evaluate(async()=>{const id=RecipeLibrary.overview().entries[0].id,start=performance.now();await RecipeLibrary.get(id);return performance.now()-start});assert.ok(documentMs<500,'opened recipe reads persisted metadata');
 delay=false;deny=true;await p.reload();await p.waitForFunction(()=>!household.busy&&household.active===null);assert.equal(await p.evaluate(()=>MorzsaCache.peek(MorzsaCache.scope(household.userId(),'90000000-0000-4000-8000-000000000001'),'household','rows',{stale:true})),null);deny=false;await p.goto(base+'/?actor=c');await p.waitForFunction(()=>household.userId()?.endsWith('3'));
 assert.equal(await p.evaluate(()=>household.active),null);assert.equal(await p.evaluate(()=>MorzsaCache.peek(MorzsaCache.scope(household.userId(),'90000000-0000-4000-8000-000000000001'),'household','rows')),null);
 assert.equal(await p.evaluate(()=>RecipeLibrary.overview()?.library.some(r=>r.ownFavourite)),false);
 // Revocation invalidates memory and disk and rejects late writes.
 await p.evaluate(async()=>{const s=MorzsaCache.current();MorzsaCache.put(s,'private','test',{value:1});await MorzsaCache.clearScope(s);MorzsaCache.put(s,'private','test',{value:2});if(MorzsaCache.peek(MorzsaCache.current(),'private','test'))throw Error('late revoked write')});
 await p.reload();await p.waitForFunction(()=>MorzsaCache.ready);assert.equal(await p.evaluate(()=>MorzsaCache.peek(MorzsaCache.current(),'private','test')),null);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,cachedKitchenPaintMs:paintMs,delayedReadMs:1600,cachedDocumentMs:documentMs,checks:['IndexedDB reload','cache-first pantry/cart/favourites/feed','background refresh','persisted image offline and renewed signature','account isolation','revocation and late writes'],errors}));
}finally{await ctx.close();await browser.close()}
