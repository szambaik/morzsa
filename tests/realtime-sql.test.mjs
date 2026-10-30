import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();await db.exec('create table public.household_records(id int); alter table public.household_records enable row level security; create publication supabase_realtime;');
const sql=fs.readFileSync(new URL('../supabase/migrations/20261030_household_realtime.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
assert.equal((await db.query("select count(*)::int as n from pg_publication_tables where pubname='supabase_realtime' and tablename='household_records'")).rows[0].n,1);
assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.household_records'::regclass")).rows[0].relrowsecurity,true);
await db.close();console.log('Realtime SQL passed: repeatable publication membership, existing RLS retained.');
