import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();await db.exec("create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
await db.exec(fs.readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';for(const id of [a,b,c])await db.query('insert into auth.users values($1)',[id]);
async function user(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
await user(a);const hid=(await db.query("select public.create_household('Home') id")).rows[0].id;
async function stock(name,value,expected){await db.query('select public.apply_household_changes($1,$2)',[hid,JSON.stringify([{bucket:'stock',key:name,value,expected}])])}
const reviews=async()=>(await db.query('select * from public.household_pantry_reviews order by product_name')).rows;
const rev=async name=>(await db.query("select revision from public.household_records where household_id=$1 and key=$2 and bucket='stock'",[hid,name])).rows[0].revision;
async function confirm(items){await db.query('select public.confirm_pantry_items($1,$2)',[hid,JSON.stringify(items)])}
await stock('legacy',2,0);await db.exec('reset role');const sql=fs.readFileSync(new URL('../supabase/migrations/20261109_pantry_reviews.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
await user(a);assert.equal((await reviews()).length,0);await stock('milk',2,0);assert.equal((await reviews()).length,1);
await confirm([{name:'legacy',revision:await rev('legacy')}]);assert.equal((await reviews()).length,2);
const before=(await reviews()).find(x=>x.product_name==='milk').last_confirmed_at;await stock('milk',2,await rev('milk'));assert.equal((await reviews()).find(x=>x.product_name==='milk').last_confirmed_at.getTime(),before.getTime());
await stock('milk',0,await rev('milk'));assert.equal((await reviews()).length,1);await assert.rejects(confirm([{name:'milk',revision:await rev('milk')}]),/Conflict/);
await stock('milk',2,await rev('milk'));await assert.rejects(confirm([{name:'milk',revision:0}]),/Conflict/);
const token=(await db.query('select public.invite_household($1) token',[hid])).rows[0].token;await user(b);await db.query('select public.join_household($1)',[token]);assert.equal((await reviews()).length,2);await confirm([{name:'milk',revision:await rev('milk')}]);assert.equal((await reviews()).find(x=>x.product_name==='milk').confirmed_by,b);
await assert.rejects(db.query('delete from public.household_pantry_reviews'),/permission denied/);
const saved=(await reviews()).find(x=>x.product_name==='milk');await assert.rejects(confirm([{name:'milk',revision:await rev('milk')},{name:'legacy',revision:0}]),/Conflict/);assert.deepEqual((await reviews()).find(x=>x.product_name==='milk'),saved);
await user(c);assert.equal((await reviews()).length,0);await assert.rejects(confirm([]),/denied/);await db.close();console.log('Pantry review SQL: repeatable, no legacy backfill, trigger, explicit confirmation, shared read, isolation, stale conflict and rollback passed.');
