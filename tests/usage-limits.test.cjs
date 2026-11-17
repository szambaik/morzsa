const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const user='12345678-1234-1234-1234-123456789012',hid='32345678-1234-1234-1234-123456789012';
test('server test flag pauses all own quotas, preserves leases/privacy, and resumes without billing test requests',async()=>{
 const {PGlite}=await import('@electric-sql/pglite'),db=new PGlite();
 try{
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
 await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
 for(const name of ['20261029_recipe_ideas','20261030_voice_commands','20261112_recipe_images','20261114_plus_assistant','20261114_persistent_library','20261115_cooking_image_jobs','20261117_plus_reservations','20261117_plus_reservations'])await db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));
 const val=async(sql,args=[])=>(await db.query(sql,args)).rows[0].v;
 const access=()=>val('select public.morzsa_plus_access($1,null) v',[user]);
 const reserve=(kind='chat',id=crypto.randomUUID())=>val('select public.reserve_morzsa_plus($1,null,$2,$3,12) v',[user,id,kind]);
 assert.equal(await val('select public.morzsa_usage_limits_enabled() v'),true);
 await db.query('insert into public.morzsa_plus_entitlements(scope,monthly_cents,chat_limit) values($1,20,2)',['user:'+user]);
 const first=crypto.randomUUID();assert.equal((await reserve('chat',first)).status,'reserved');
 assert.equal((await reserve()).reason,'budget');
 await db.query("update public.morzsa_plus_requests set state='failed' where request_id=$1",[first]);assert.equal((await access()).remainingCents,20);
 await db.query('update public.morzsa_plus_requests set charged_cents=3 where request_id=$1',[first]);assert.equal((await access()).remainingCents,17);
 assert.equal((await reserve()).status,'reserved');
 await db.exec('update public.morzsa_runtime_settings set usage_limits_enabled=false');
 const status=await access();assert.equal(status.usageLimitsEnabled,false);assert.equal(status.remainingCents,null);
 for(const kind of ['chat','image','voice'])assert.equal((await reserve(kind)).status,'reserved');
 assert.equal((await reserve('voice')).status,'pending');
 assert.equal((await reserve('chat',first)).status,'duplicate');
 assert.equal(await val('select count(*)::int v from public.morzsa_plus_requests where not usage_counted'),3);
 assert.equal((await val('select public.morzsa_plus_access($1,$2) v',[user,hid])).enabled,false);
 assert.equal((await val('select public.reserve_morzsa_plus(gen_random_uuid(),null,gen_random_uuid(),$1,12) v',['chat'])).status,'denied');
 await db.exec("update public.morzsa_plus_entitlements set enabled=false where scope='global'");assert.equal((await reserve()).status,'disabled');await db.exec("update public.morzsa_plus_entitlements set enabled=true where scope='global'");
 // Exercise each Free path past its normal limits. No daily counters advance.
 for(const name of ['claim_recipe_idea_request','claim_voice_command'])for(let i=0;i<35;i++)assert.equal(await val('select public.'+name+'($1) v',[user]),true);
 for(let i=0;i<22;i++)assert.equal((await val('select public.claim_recipe_image($1,$2) v',[user,i.toString(16).padStart(64,'0')])).status,'claimed');
 assert.equal((await val('select public.claim_recipe_image($1,$2) v',[user,'0'.repeat(64)])).status,'pending');
 const rid=crypto.randomUUID();await db.query('insert into auth.users values($1)',[user]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.query('select public.save_recipe_document($1,$2)',[rid,JSON.stringify({title:'Test recipe',summary:'Soup',minutes:10,ingredients:[{name:'Tej',amount:'1 dl'}],steps:['Warm the milk.']})]);
 await db.query("insert into public.recipe_asset_usage values(current_date,'global',1000)");
 assert.equal((await val('select public.claim_recipe_asset($1,0,$2,$3) v',[rid,user,'test'])).status,'claimed');
 assert.equal((await val('select public.claim_recipe_asset($1,0,$2,$3) v',[rid,user,'test'])).status,'pending');
 for(const table of ['recipe_idea_usage','voice_command_usage','recipe_image_usage'])assert.equal(await val('select coalesce(sum(calls),0)::int v from public.'+table),0);
 assert.equal(await val('select sum(calls)::int v from public.recipe_asset_usage'),1000);
 await db.exec('set role authenticated');
 await assert.rejects(db.query('update public.morzsa_runtime_settings set usage_limits_enabled=true'),/permission denied/);
 await assert.rejects(db.query('select public.morzsa_usage_limits_enabled()'),/permission denied/);
 await assert.rejects(db.query('select public.reserve_morzsa_plus($1,null,gen_random_uuid(),$2,12)',[user,'chat']),/permission denied/);
 await db.exec('reset role;update public.morzsa_runtime_settings set usage_limits_enabled=true');
 assert.equal((await access()).remainingCents,5); // Only pre-test 3c + 12c.
 assert.equal((await reserve()).reason,'budget');
 await db.query('update public.morzsa_plus_entitlements set monthly_cents=1000 where scope=$1',['user:'+user]);assert.equal((await reserve()).reason,'requests');
 for(let i=0;i<10;i++)assert.equal(await val('select public.claim_recipe_idea_request($1) v',[user]),true);
 assert.equal(await val('select public.claim_recipe_idea_request($1) v',[user]),false);
 assert.equal((await val('select public.claim_recipe_asset($1,1,$2,$3) v',[rid,user,'test'])).status,'limit');
 }finally{await db.close()}
});
