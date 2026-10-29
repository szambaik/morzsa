import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec("create schema auth; create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
await db.exec(fs.readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
for(const id of [a,b,c])await db.query('insert into auth.users values($1)',[id]);
async function user(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
await user(a);const hid=(await db.query("select public.create_household('Home') id")).rows[0].id;
await db.query('select public.apply_household_changes($1,$2)',[hid,JSON.stringify([{bucket:'cart',key:'milk',value:{name:'milk',quantity:2},expected:0}])]);
await assert.rejects(db.query('select public.apply_household_changes($1,$2)',[hid,JSON.stringify([{bucket:'cart',key:'milk',value:{name:'milk',quantity:5},expected:0}])]),/Conflict/);
const token=(await db.query('select public.invite_household($1) token',[hid])).rows[0].token;
await user(c);assert.equal((await db.query('select * from public.household_records')).rows.length,0);await assert.rejects(db.query('select public.apply_household_changes($1,$2)',[hid,'[]']),/denied/);await assert.rejects(db.query("insert into public.household_records values($1,'cart','x','{}',1)",[hid]),/permission denied/);
await user(b);assert.equal((await db.query('select public.join_household($1) id',[token])).rows[0].id,hid);await assert.rejects(db.query('select public.join_household($1)',[token]),/already used/);assert.equal((await db.query('select * from public.household_records')).rows.length,1);
// Conflict in the second operation must roll back the entire batch.
await assert.rejects(db.query('select public.apply_household_changes($1,$2)',[hid,JSON.stringify([{bucket:'stock',key:'milk',value:2,expected:0},{bucket:'cart',key:'milk',value:null,expected:0}])]),/Conflict/);assert.equal((await db.query("select * from public.household_records where bucket='stock'")).rows.length,0);
await user(a);await db.query('select public.remove_household_member($1,$2)',[hid,b]);await user(b);assert.equal((await db.query('select * from public.household_records')).rows.length,0);
console.log('SQL passed: membership, RLS isolation, direct writes denied, invitation single use, stale writes rejected, atomic rollback, revoked access.');await db.close();
