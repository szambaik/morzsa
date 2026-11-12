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
