import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
for(const name of ['20261109_pantry_reviews','20261113_kitchen_intelligence','20261114_shopping_mode','20261114_persistent_library','20261115_detailed_recipe_steps','20261115_recipe_portions','20261116_performance_index'])await db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));
const migration=fs.readFileSync('supabase/migrations/20261118_household_collaboration.sql','utf8');await db.exec(migration);await db.exec(migration);const cacheMigration=fs.readFileSync('supabase/migrations/20261118_scoped_result_cache.sql','utf8');await db.exec(cacheMigration);await db.exec(cacheMigration);
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
for(const [id,name] of [[a,'Anna'],[b,'Peti'],[c,'Outside']])await db.query('insert into auth.users values($1,$2,$3)',[id,name+'@example.test',JSON.stringify({full_name:name})]);
async function user(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)}
async function rpc(name,args=[]){return (await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') data',args)).rows[0].data}
await user(a);const hid=await rpc('create_household',['Home']),other=await rpc('create_household',['Other home']),token=await rpc('invite_household',[hid]);await user(b);await rpc('join_household',[token]);
await rpc('set_household_preferences',[hid,JSON.stringify([{key:'avoid',value:['gomba'],expected:0},{key:'diet',value:'vegetarian',expected:0},{key:'maxMinutes',value:25,expected:0}]),'Peti']);
await user(a);assert.equal((await rpc('household_collaboration_snapshot',[hid])).members.find(m=>m.user_id===b).name,'Peti');
assert.equal((await db.query('select value from public.household_kitchen_preferences where household_id=$1 and key=$2',[hid,'diet'])).rows[0].value,'vegetarian');
await assert.rejects(rpc('set_household_preferences',[hid,JSON.stringify([{key:'diet',value:'vegan',expected:0}]),'Wrong stale name']),/Conflict/);
await user(b);assert.equal((await rpc('household_collaboration_snapshot',[hid])).members.find(m=>m.user_id===b).name,'Peti');
await assert.rejects(rpc('set_household_preferences',[hid,'[]','bad\nname']),/Invalid display name/);

const hash='a'.repeat(64),model='test-v1';
const lookup=()=>rpc('get_morzsa_result_cache',[a,hid,'assistant_text',hash,model]);
const put=(version,payload={answer:'Private'},ttl=300)=>rpc('put_morzsa_result_cache',[a,hid,'assistant_text',hash,model,version,JSON.stringify(payload),ttl]);
await assert.rejects(lookup(),/permission denied/);
await assert.rejects(db.query('select * from public.morzsa_result_cache'),/permission denied/);
await user(a,'service_role');let hit=await lookup();assert.equal(hit.payload,null);assert.equal(await put(hit.version),true);assert.equal((await lookup()).payload.answer,'Private');
assert.equal((await rpc('get_morzsa_result_cache',[b,hid,'assistant_text',hash,model])).payload,null);
assert.equal((await rpc('get_morzsa_result_cache',[a,other,'assistant_text',hash,model])).payload,null);
assert.equal((await rpc('get_morzsa_result_cache',[a,hid,'assistant_text',hash,'test-v2'])).payload,null);
await assert.rejects(rpc('get_morzsa_result_cache',[c,hid,'assistant_text',hash,model]),/denied/);
await user(a);await rpc('apply_household_changes',[hid,JSON.stringify([{bucket:'stock',key:'Tej',value:2,expected:0}])]);
await user(a,'service_role');assert.equal((await lookup()).payload,null);assert.equal(await put(hit.version),false);hit=await lookup();assert.equal(await put(hit.version),true);
await user(a);await rpc('set_household_preferences',[hid,JSON.stringify([{key:'diet',value:'vegan',expected:1}]),'Anna']);
await user(a,'service_role');assert.equal((await lookup()).payload,null);hit=await lookup();await put(hit.version);
await db.exec("reset role;update public.morzsa_result_cache set expires_at=now()-interval '1 second';set role service_role");assert.equal((await lookup()).payload,null);
assert.equal(await put(hit.version,{answer:'a'.repeat(530000)}),false);
// Dashboard hits retain the complete existing response and refresh after writes.
await user(a);const first=await rpc('household_collaboration_snapshot',[hid]);assert.deepEqual(await rpc('household_collaboration_snapshot',[hid]),first);assert.deepEqual(Object.keys(first).sort(),['cooked','cooking','events','members','preferences']);
await rpc('apply_household_changes',[hid,JSON.stringify([{bucket:'stock',key:'Tej',value:0,expected:1}])]);assert.notDeepEqual(await rpc('household_collaboration_snapshot',[hid]),first);
// Active cooking metadata and share revocation both invalidate the dashboard.
const rid='30000000-0000-4000-8000-000000000001',cid='40000000-0000-4000-8000-000000000001';
const recipe={title:'Omlett',summary:'Egyszerű',minutes:15,servings:2,ingredients:[{name:'Tojás',amount:'2 db'}],stepTitles:['Sütés'],steps:['Süsd meg.']};
await rpc('save_recipe_document',[rid,JSON.stringify(recipe)]);await rpc('set_recipe_library',[rid,true,'started']);
const meta={kind:'recipe',title:'Omlett',recipe:{...recipe,recipeId:rid},status:'active',cookingStep:0,cooking:{phase:'guided',activity:'active'}};
await rpc('sync_conversation',[cid,JSON.stringify(meta),0,'[]',[rid]]);await rpc('adopt_household_recipes',[hid]);assert.equal((await rpc('household_collaboration_snapshot',[hid])).cooking.length,1);
await rpc('sync_conversation',[cid,JSON.stringify({...meta,cooking:{phase:'guided',activity:'paused'}}),1,'[]',[rid]]);assert.equal((await rpc('household_collaboration_snapshot',[hid])).cooking[0].activity,'paused');
await rpc('share_conversation',[cid,null]);assert.equal((await rpc('household_collaboration_snapshot',[hid])).cooking.length,0);
await user(a,'service_role');const fresh=await lookup();await put(fresh.version);
await user(a);await rpc('remove_household_member',[hid,b]);await user(b);await assert.rejects(rpc('household_collaboration_snapshot',[hid]),/denied/);
await user(a,'service_role');await assert.rejects(rpc('get_morzsa_result_cache',[b,hid,'assistant_text',hash,model]),/denied/);assert.equal(await rpc('put_morzsa_result_cache',[b,hid,'assistant_text',hash,model,0,'{}',300]),false);
await user(null,'anon');await assert.rejects(lookup(),/permission denied/);await assert.rejects(rpc('household_collaboration_snapshot_source',[hid]),/permission denied/);
await db.close();console.log('Scoped cache SQL passed: repeatable migration, service-only access, user/household/model isolation, membership revocation, versioned stock/preferences/cooking/shares, expired and oversized outputs, stale inference protection, unchanged dashboard contract.');
