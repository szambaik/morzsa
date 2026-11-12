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
