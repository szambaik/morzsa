const {test}=require('node:test'),assert=require('node:assert/strict');
const recipe={title:'Palacsinta',summary:'Finom',minutes:20,ingredients:[{name:'Liszt',amount:'100 g'}],steps:['Keverd össze.']};
test('images require valid recipes and bounded steps, never a paid model fallback',async()=>{
 const {imageInput,cloudImage}=await import('../supabase/functions/recipe-image/handler.mjs');
 assert.equal(imageInput({recipe}).step,-1);assert.throws(()=>imageInput({recipe,step:1}));assert.throws(()=>imageInput({recipe:{}}));
 let calls=0;await assert.rejects(()=>cloudImage({recipe,step:-1},{model:'paid-model',account:'a'.repeat(32)},async()=>{calls++}),/IMAGE_SETUP_REQUIRED/);assert.equal(calls,0);
});
test('image API handles CORS preflight and requires auth before generation',async()=>{
 const {createHandler}=await import('../supabase/functions/recipe-image/handler.mjs');let calls=0;
 const fn=createHandler({origins:['https://app'],account:'a'.repeat(32),token:'t',serviceKey:'s'},async()=>{calls++});
 assert.equal((await fn(new Request('https://fn',{method:'OPTIONS',headers:{origin:'https://app'}}))).status,204);
 assert.equal((await fn(new Request('https://fn',{method:'POST'}))).status,401);assert.equal(calls,0);
});
test('image reservation is repeatable, private, deduplicated and globally capped',async()=>{
 const {PGlite}=await import('@electric-sql/pglite'),fs=require('node:fs');const db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');const sql=fs.readFileSync('supabase/migrations/20261112_recipe_images.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.recipe_image_jobs'));await assert.rejects(db.query("select public.claim_recipe_image('12345678-1234-1234-1234-123456789012',repeat('a',64))"));await db.exec('reset role');await db.exec('set role service_role');
 const claim=async(user,n)=>(await db.query('select public.claim_recipe_image($1,$2) result',['12345678-1234-1234-1234-'+String(user).padStart(12,'0'),n.toString(16).padStart(64,'0')])).rows[0].result;
 const first=await claim(1,1);assert.equal(first.status,'claimed');assert.equal((await claim(1,1)).status,'pending');
 for(let i=2;i<=20;i++)assert.equal((await claim(1,i)).status,'claimed');assert.equal((await claim(1,21)).status,'limit');
 for(let i=1;i<=20;i++)assert.equal((await claim(2,i)).status,'claimed');for(let i=1;i<=10;i++)assert.equal((await claim(3,i)).status,'claimed');assert.equal((await claim(3,11)).status,'limit');
 await db.query("update public.recipe_image_jobs set state='ready',asset_path='cached' where owner_id=$1 and cache_key=$2",['12345678-1234-1234-1234-000000000001','1'.padStart(64,'0')]);assert.equal((await claim(1,1)).status,'ready');await db.close();
});
test('Hungarian recipes and step context are translated before image generation; bad prompts fail closed',async()=>{
 const {cloudImage,IMAGE_PROMPT_VERSION}=await import('../supabase/functions/recipe-image/handler.mjs');
 const porridge={...recipe,title:'Prémium zabkása',summary:'Krémes reggeli',ingredients:[{name:'Zabpehely',amount:'50 g'},{name:'Tej',amount:'200 ml'}],steps:['Főzd krémesre a zabot a tejben.']};
 const config={model:'@cf/black-forest-labs/flux-1-schnell',account:'a'.repeat(32),token:'cf',groqKey:'groq'};let calls=[];
 const fetcher=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});if(url.includes('groq.com'))return Response.json({choices:[{message:{content:JSON.stringify({dish:'Creamy oatmeal porridge',scene:'A bowl of creamy cooked rolled oats and milk, with the soft oatmeal texture clearly visible. A simple breakfast without extra toppings.'})}}]});return Response.json({success:true,result:{image:Buffer.from([255,216,255,0]).toString('base64')}})};
 await cloudImage({recipe:porridge,step:0},config,fetcher);assert.equal(calls.length,2);assert.equal(JSON.parse(calls[0].body.messages[1].content).step,0);assert.match(calls[0].body.messages[1].content,/zabkása/);assert.match(calls[1].body.prompt,/oatmeal porridge/);assert.doesNotMatch(calls[1].body.prompt,/cream ceramic plate|Recipe \(Hungarian/);assert.equal(IMAGE_PROMPT_VERSION,2);
 let cloudCalls=0;await assert.rejects(()=>cloudImage({recipe:porridge,step:-1},config,async url=>{if(!url.includes('groq.com'))cloudCalls++;return Response.json({choices:[{message:{content:'{"dish":"x","scene":""}'}}]})}),/IMAGE_UNAVAILABLE/);assert.equal(cloudCalls,0);
});

test('recipe title metadata leaves the image cache input unchanged',async()=>{
 const {imageInput}=await import('../supabase/functions/recipe-image/handler.mjs');
 assert.deepEqual(imageInput({recipe:{...recipe,stepTitles:['A tészta összeállítása']}}),imageInput({recipe}));
});
test('the cooking hero reuses the chat cover with named steps and loads it eagerly',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let calls=[];
 const host=()=>({isConnected:true,children:[],dataset:{},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)}});
 const context={window:{MORZSA_CLOUD:{url:'https://test.supabase.co'}},household:{active:null,userId:()=> 'test',recipeImage:async input=>{calls.push(input);return {status:'ready',url:'https://test.supabase.co/storage/v1/object/sign/cover',expiresAt:Date.now()+60000}}},language:'hu',document:{createElement:tag=>({tag})},IntersectionObserver:class{constructor(callback){this.callback=callback}observe(){this.callback([{isIntersecting:true}])}disconnect(){}},console};
 vm.runInNewContext(fs.readFileSync('recipe-images.js','utf8'),context);
 const images=context.window.RecipeImages,card=host();images.enqueue([recipe]);images.mount(card,recipe);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(calls[0].create,true);
 const hero=host();images.mount(hero,{...recipe,stepTitles:['Tészta összeállítása']},-1,{autoCreate:true,hero:true});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(hero.children[0].src,card.children[0].src);assert.equal(hero.children[0].loading,'eager');assert.equal(hero.children[0].fetchPriority,'high');assert.equal(hero.dataset.imageStatus,'ready');
});

test('a late cache miss from the chat card creates the cooking cover once',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let calls=[],completeLookup;
 const host=()=>({isConnected:true,children:[],dataset:{},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)}});
 const context={window:{MORZSA_CLOUD:{url:'https://test.supabase.co'}},household:{active:null,userId:()=> 'test',recipeImage:input=>{calls.push(input);return input.create?Promise.resolve({status:'ready',url:'https://test.supabase.co/storage/v1/object/sign/cover'}):new Promise(resolve=>completeLookup=resolve)}},language:'hu',document:{createElement:tag=>({tag})},IntersectionObserver:class{constructor(cb){this.callback=cb}observe(){this.callback([{isIntersecting:true}])}disconnect(){}}};
 vm.runInNewContext(fs.readFileSync('recipe-images.js','utf8'),context);
 const images=context.window.RecipeImages;images.mount(host(),recipe);await new Promise(resolve=>setImmediate(resolve));
 const hero=host();images.mount(hero,recipe,-1,{autoCreate:true,hero:true});completeLookup({status:'missing'});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls.map(c=>c.create),[false,true]);assert.equal(hero.dataset.imageStatus,'ready');
});
test('library covers preserve their layout class and never generate images on cache miss',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let calls=[];
 const card={className:'room-image-cache',isConnected:true,children:[],dataset:{},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)}};
 const context={window:{MORZSA_CLOUD:{url:'https://test.supabase.co'}},household:{active:null,userId:()=> 'test',recipeImage:async input=>{calls.push(input);return {status:'missing'}}},language:'hu',document:{createElement:tag=>({tag})},IntersectionObserver:class{constructor(cb){this.callback=cb}observe(){this.callback([{isIntersecting:true}])}disconnect(){}}};
 vm.runInNewContext(fs.readFileSync('recipe-images.js','utf8'),context);context.window.RecipeImages.enqueue([recipe]);context.window.RecipeImages.mount(card,recipe,-1,{cacheOnly:true});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(calls[0].create,false);assert.equal(card.children.length,0);assert.match(card.className,/room-image-cache/);assert.match(card.className,/generated-recipe-image/);
});

function imageApiFixture({cached=true,claim='claimed',failLookup=false,failSign=false,groqStatus=200}={}){
 const calls=[],owner='12345678-1234-1234-1234-123456789012',lease='23456789-1234-1234-1234-123456789012';let lookupFailed=false,signFailed=false,key;
 const config={url:'https://test.supabase.co',publishableKey:'anon',serviceKey:'service',account:'a'.repeat(32),token:'cf',groqKey:'groq',model:'@cf/black-forest-labs/flux-1-schnell',origins:['https://app']};
 const fetcher=async(url,options={})=>{calls.push({url,method:options.method||'GET'});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:owner});
  if(url.includes('/rest/v1/recipe_image_jobs?')){key=new URL(url).searchParams.get('cache_key').slice(3);if(options.method==='PATCH')return Response.json([{}]);if(failLookup&&!lookupFailed){lookupFailed=true;return Response.json({}, {status:503})}return Response.json(cached?[{state:'ready',asset_path:owner+'/'+key+'/'+lease+'.jpg'}]:[])}
  if(url.endsWith('/rpc/claim_recipe_image'))return Response.json({status:claim,lease});
  if(url.includes('groq.com'))return groqStatus!==200?Response.json({}, {status:groqStatus}):Response.json({choices:[{message:{content:JSON.stringify({dish:'Pancakes',scene:'A stack of thin golden home-cooked pancakes on a simple plate with a soft, delicate texture and no additional toppings.'})}}]});
  if(url.includes('cloudflare.com'))return Response.json({success:true,result:{image:Buffer.from([255,216,255,0]).toString('base64')}});
  if(url.includes('/storage/v1/object/sign/')){if(failSign&&!signFailed){signFailed=true;return Response.json({}, {status:503})}return Response.json({signedURL:'/object/sign/recipe-images/'+owner+'/'+key+'/'+lease+'.jpg?token=test'})}
  if(url.includes('/storage/v1/object/recipe-images/'))return Response.json({});
  throw Error('Unexpected test route');
 };
 return {config,fetcher,calls,request:create=>new Request('https://function',{method:'POST',headers:{origin:'https://app',Authorization:'Bearer user'},body:JSON.stringify({recipe,step:-1,create})})};
}
test('cached images recover from one transient lookup and signing failure without generating again',async()=>{
 const {createHandler}=await import('../supabase/functions/recipe-image/handler.mjs');const f=imageApiFixture({failLookup:true,failSign:true});const response=await createHandler(f.config,f.fetcher)(f.request(true));
 assert.equal(response.status,200);assert.ok((await response.json()).url.startsWith('https://test.supabase.co/storage/v1/object/sign/recipe-images/'));
 assert.equal(f.calls.filter(c=>c.url.includes('recipe_image_jobs')).length,2);assert.equal(f.calls.filter(c=>c.url.includes('object/sign')).length,2);assert.equal(f.calls.some(c=>c.url.includes('cloudflare')||c.url.includes('groq')||c.url.includes('claim_recipe_image')),false);
});
test('complete image generation uploads privately and signs the ready image',async()=>{
 const {createHandler}=await import('../supabase/functions/recipe-image/handler.mjs');const f=imageApiFixture({cached:false});const response=await createHandler(f.config,f.fetcher)(f.request(true));
 assert.equal(response.status,200);assert.equal((await response.json()).status,'ready');
 for(const route of ['groq.com','cloudflare.com','/storage/v1/object/recipe-images/','/storage/v1/object/sign/'])assert.equal(f.calls.filter(c=>c.url.includes(route)).length,1);
 assert.equal(f.calls.filter(c=>c.method==='PATCH').length,1);
});
test('cooldown and provider quota stay distinct from the app daily quota without repeat generation',async()=>{
 const {createHandler}=await import('../supabase/functions/recipe-image/handler.mjs');
 const f=imageApiFixture({cached:false,claim:'cooldown'});let response=await createHandler(f.config,f.fetcher)(f.request(true));assert.equal(response.status,429);assert.deepEqual(await response.json(),{error:'IMAGE_COOLDOWN',retryAfter:60});assert.equal(f.calls.some(c=>c.url.includes('groq')),false);
 const busy=imageApiFixture({cached:false,groqStatus:429});response=await createHandler(busy.config,busy.fetcher)(busy.request(true));assert.equal(response.status,429);assert.equal((await response.json()).error,'IMAGE_PROVIDER_LIMIT');assert.equal(busy.calls.filter(c=>c.url.includes('groq')).length,1);assert.equal(busy.calls.some(c=>c.url.includes('cloudflare')),false);
});
test('frontend explains cooldown, blocks repeated clicks, then enables a manual retry',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let calls=0,retryTimer;const host={isConnected:true,children:[],dataset:{},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)}};
 const context={window:{MORZSA_CLOUD:{url:'https://test.supabase.co'}},household:{active:null,userId:()=> 'test',recipeImage:async()=>{calls++;throw Object.assign(Error('IMAGE_COOLDOWN'),{retryAfter:60})}},language:'hu',document:{createElement:tag=>({tag})},IntersectionObserver:class{constructor(cb){this.cb=cb}observe(){this.cb([{isIntersecting:true}])}disconnect(){}},setTimeout:fn=>retryTimer=fn};
 vm.runInNewContext(fs.readFileSync('recipe-images.js','utf8'),context);context.window.RecipeImages.mount(host,recipe);await new Promise(resolve=>setImmediate(resolve));assert.equal(host.dataset.imageStatus,'failed');assert.equal(host.children[0].disabled,true);assert.match(host.children[1].textContent,/Várj egy percet/);await host.children[0].onclick();assert.equal(calls,1);retryTimer();assert.equal(host.children[0].disabled,false);assert.equal(calls,1);
});
test('a broken image link refreshes the cache without consuming another generation',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');const inputs=[];const host={isConnected:true,children:[],dataset:{},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)}};
 const context={window:{MORZSA_CLOUD:{url:'https://test.supabase.co'}},household:{active:null,userId:()=> 'test',recipeImage:async input=>{inputs.push(input);return {status:'ready',url:'https://test.supabase.co/storage/v1/object/sign/cover'}}},language:'hu',document:{createElement:tag=>({tag})},IntersectionObserver:class{constructor(cb){this.cb=cb}observe(){this.cb([{isIntersecting:true}])}disconnect(){}}};
 vm.runInNewContext(fs.readFileSync('recipe-images.js','utf8'),context);context.window.RecipeImages.mount(host,recipe,-1,{autoCreate:true});await new Promise(resolve=>setImmediate(resolve));host.children[0].onerror();assert.match(host.children[1].textContent,/Frissítsd a kép linkjét/);await host.children[0].onclick();assert.deepEqual(inputs.map(i=>i.create),[true,false]);assert.equal(host.dataset.imageStatus,'ready');
});
