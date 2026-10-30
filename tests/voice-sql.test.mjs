import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
const sql=await readFile(new URL('../supabase/migrations/20261030_voice_commands.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.voice_command_usage'));await assert.rejects(db.query("select public.claim_voice_command('12345678-1234-1234-1234-123456789012')"));await db.exec('reset role');
await db.exec('set role service_role');
const claim=async id=>(await db.query('select public.claim_voice_command($1) as ok',[id])).rows[0].ok;
for(let user=1;user<=10;user++){const id='12345678-1234-1234-1234-'+String(user).padStart(12,'0');for(let n=0;n<30;n++)assert.equal(await claim(id),true);assert.equal(await claim(id),false)}
assert.equal(await claim('12345678-1234-1234-1234-999999999999'),false);
await db.close();console.log('Voice SQL passed: repeatable migration, private cache, service-only quota, per-user and global daily limits.');
