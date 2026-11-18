import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
for(const name of ['20261109_pantry_reviews','20261113_kitchen_intelligence','20261114_shopping_mode','20261114_persistent_library','20261115_detailed_recipe_steps','20261115_recipe_portions','20261116_performance_index'])await db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));
const migration=fs.readFileSync('supabase/migrations/20261118_household_collaboration.sql','utf8');await db.exec(migration);await db.exec(migration);
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
const recipe={title:'Zöldséges omlett',summary:'Közös recept',minutes:15,servings:2,ingredients:[{name:'Tojás',amount:'2 db'}],stepTitles:['Sütés'],steps:['Süsd meg lassú tűzön.']},rid='30000000-0000-4000-8000-000000000001',cid='40000000-0000-4000-8000-000000000001',privateId='40000000-0000-4000-8000-000000000002';
await user(a);await rpc('save_recipe_document',[rid,JSON.stringify(recipe)]);await rpc('set_recipe_library',[rid,true,'started']);
const meta={kind:'recipe',recipe:{...recipe,recipeId:rid},title:recipe.title,parentId:privateId,status:'active',cookingStep:0,cooking:{phase:'guided',activity:'active',activityAt:Date.now()}};
const messages=[{id:'50000000-0000-4000-8000-000000000001',role:'user',text:'Meddig süssem?',createdAt:Date.now(),recipes:[]}];
await rpc('sync_conversation',[cid,JSON.stringify(meta),0,JSON.stringify(messages),[rid]]);
await rpc('sync_conversation',[privateId,JSON.stringify({kind:'chat',title:'Private conversation'}),0,'[]',[]]);
await user(b);assert.equal(await rpc('can_read_recipe',[rid]),false);assert.equal((await rpc('conversation_index')).length,0);
await user(a);await rpc('adopt_household_recipes',[hid]);await rpc('adopt_household_recipes',[hid]);
await user(b);let index=await rpc('household_recipe_index',[hid]);assert.equal(index.length,1);assert.equal(index[0].favourite,true);assert.equal(index[0].ownFavourite,false);assert.equal(index[0].status,'started');assert.equal(await rpc('can_read_recipe',[rid]),true);
assert.equal((await rpc('conversation_page',[cid])).messages[0].body.text,'Meddig süssem?');let chats=await rpc('conversation_index');assert.equal(chats.length,1);assert.equal(chats[0].metadata.parentId,undefined);assert.equal(chats[0].owner,false);
await assert.rejects(rpc('conversation_page',[privateId]),/denied/);await assert.rejects(rpc('sync_conversation',[cid,JSON.stringify(meta),1,'[]',[rid]]),/denied/);
await rpc('set_household_recipe_library',[hid,rid,true,'saved']);await rpc('set_household_recipe_library',[hid,rid,false,'saved']);index=await rpc('household_recipe_index',[hid]);assert.equal(index[0].favourite,true);assert.equal(index[0].ownFavourite,false);
const ownCooking='40000000-0000-4000-8000-000000000003';await rpc('sync_conversation',[ownCooking,JSON.stringify({...meta,title:'My cooking'}),0,'[]',[rid]]);await rpc('share_household_recipe_conversation',[hid,ownCooking]);
let cooking=(await rpc('household_collaboration_snapshot',[hid])).cooking;assert.equal(cooking.length,2);assert.equal(cooking.find(x=>x.conversationId===cid).actorName,'Anna');assert.equal(cooking.find(x=>x.conversationId===ownCooking).recipeId,rid);
await user(a);await rpc('sync_conversation',[cid,JSON.stringify({...meta,cooking:{...meta.cooking,activity:'paused'}}),1,'[]',[rid]]);await user(b);assert.equal((await rpc('household_collaboration_snapshot',[hid])).cooking.find(x=>x.conversationId===cid).activity,'paused');
await user(a);await rpc('sync_conversation',[cid,JSON.stringify({...meta,status:'completed',cooking:{phase:'completion'}}),2,'[]',[rid]]);await user(b);assert.equal((await rpc('household_collaboration_snapshot',[hid])).cooking.some(x=>x.conversationId===cid),false);
await user(a);await rpc('adopt_household_recipes',[other]);assert.equal((await rpc('household_recipe_index',[other])).length,0);await assert.rejects(rpc('share_household_recipe_conversation',[other,cid]),/another household/);await assert.rejects(rpc('share_household_recipe_conversation',[hid,privateId]),/denied/);

// Two stale clients cannot duplicate a product, replace a partner's quantity,
// forge authors, or replay a committed addition after a subsequent removal.
const add=[{bucket:'cart',key:'Tej',value:{name:'Tej',quantity:1,done:false,addedBy:c},expected:0}],batch='60000000-0000-4000-8000-000000000001';
await user(a);assert.equal((await rpc('apply_household_changes_once',[hid,batch,JSON.stringify(add)])).replayed,false);
await user(b);await assert.rejects(rpc('apply_household_changes',[hid,JSON.stringify([{bucket:'cart',key:' tej ',value:{name:' tej ',quantity:2,done:false},expected:0}])]),/Conflict/);
await rpc('apply_household_changes',[hid,JSON.stringify([{bucket:'cart',key:'tej',value:{name:'tej',quantity:9,done:false},expected:1}])]);
await user(a);await assert.rejects(rpc('apply_household_changes',[hid,JSON.stringify([{bucket:'cart',key:'Tej',value:{name:'Tej',quantity:1,done:true},expected:1}])]),/Conflict/);
await rpc('apply_household_changes',[hid,JSON.stringify([{bucket:'cart',key:'Tej',value:{name:'Tej',quantity:9,done:true,purchasedBy:c},expected:2}])]);let rows=(await db.query("select * from public.household_records where bucket='cart' and value is not null")).rows;assert.equal(rows.length,1);assert.equal(rows[0].value.quantity,9);assert.equal(rows[0].value.addedBy,a);assert.equal(rows[0].value.purchasedBy,a);
await user(b);await rpc('apply_household_changes',[hid,JSON.stringify([{bucket:'cart',key:'Tej',value:null,expected:3}])]);await user(a);assert.equal((await rpc('apply_household_changes_once',[hid,batch,JSON.stringify(add)])).replayed,true);assert.equal((await db.query("select * from public.household_records where bucket='cart' and value is not null")).rows.length,0);
const before=(await rpc('household_collaboration_snapshot',[hid])).events.length;await rpc('apply_household_changes_once',[hid,batch,JSON.stringify(add)]);assert.equal((await rpc('household_collaboration_snapshot',[hid])).events.length,before);
assert.equal((await rpc('household_collaboration_snapshot',[hid])).events.find(e=>e.event_type==='list_removed').actor_name,'Peti');
await assert.rejects(db.query("insert into public.household_records(household_id,bucket,key,value) values($1,'cart','forged','{}')",[hid]),/permission denied/);
await user(c);for(const name of ['household_collaboration_snapshot','household_recipe_index','adopt_household_recipes'])await assert.rejects(rpc(name,[hid]),/denied/);assert.equal((await db.query('select * from public.household_recipe_entries')).rows.length,0);assert.equal((await db.query('select * from public.household_member_names')).rows.length,0);assert.equal(await rpc('can_read_recipe',[rid]),false);
await assert.rejects(rpc('apply_household_changes_once',[hid,batch,'[]']),/denied/);await user(null,'anon');await assert.rejects(rpc('household_collaboration_snapshot',[hid]),/permission denied/);
await user(a);await rpc('share_conversation',[cid,null]);await rpc('adopt_household_recipes',[hid]);await user(b);await assert.rejects(rpc('conversation_page',[cid]),/denied/);await user(a);await rpc('remove_household_member',[hid,b]);await user(b);await assert.rejects(rpc('household_recipe_index',[hid]),/denied/);await assert.rejects(rpc('conversation_page',[cid]),/denied/);
await db.close();console.log('Household collaboration SQL passed: repeatable migration, default shared recipe adoption, private chats, immutable IDs, per-member favourites, current cooking, member names, shared preferences, normalized concurrent list changes, attribution, idempotent retries and revoked access.');
