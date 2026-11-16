import fs from 'node:fs';import path from 'node:path';import {startFixture,actors,householdId} from './fixture.mjs';
const root=path.resolve(import.meta.dirname,'../..'),dir=path.join(import.meta.dirname,'database-runs',new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(dir,{recursive:true});
const f=await startFixture({repoRoot:root}),d=f.db,r={environment:'PGlite WASM PostgreSQL in memory. Synthetic fixtures. No production measurements.',samples:[],plans:{},indexes:[]};
try{
 await d.exec('reset role');await d.query("select set_config('request.jwt.claim.sub',$1,false)",[actors.a]);r.indexes=(await d.query("select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname")).rows;
 async function measure(label,sql,args=[]){const samples=[];let rows;for(let i=0;i<7;i++){const t=performance.now();rows=(await d.query(sql,args)).rows;samples.push(performance.now()-t)}r.samples.push({label,sql,samplesMs:samples,returnedRows:rows.length,jsonBytes:Buffer.byteLength(JSON.stringify(rows))});r.plans[label]=(await d.query('explain (analyze,buffers,format json) '+sql,args)).rows}
 for(const n of [100,1000,5000]){
  await d.exec('truncate public.conversations cascade');await d.query("insert into public.conversations(id,owner_id,metadata,updated_at) select gen_random_uuid(),case when i<=50 then $1::uuid else $2::uuid end,jsonb_build_object('title','Synthetic chat '||i),now()-(i||' seconds')::interval from generate_series(1,$3::int) i",[actors.a,actors.c,n]);await d.exec('analyze public.conversations');
  await measure('conversation_index_'+n,'select public.conversation_index(0)');
  await measure('conversation_inner_'+n,'select id from public.conversations where public.can_read_conversation(id) order by updated_at desc,id limit 100');
  await measure('owner_index_diagnostic_'+n,'select id from public.conversations where owner_id=$1 and deleted_at is null order by updated_at desc,id limit 100',[actors.a]);
 }
 const cid=(await d.query('select id from public.conversations where owner_id=$1 limit 1',[actors.a])).rows[0].id;
 await d.query("insert into public.conversation_messages(id,conversation_id,body) select gen_random_uuid(),$1,jsonb_build_object('text','Synthetic message '||i,'role','user') from generate_series(1,10000) i",[cid]);await d.exec('analyze public.conversation_messages');await measure('conversation_page_10000','select public.conversation_page($1)',[cid]);await measure('conversation_page_inner_10000','select * from public.conversation_messages where conversation_id=$1 order by sequence desc limit 50',[cid]);
 for(const n of [100,1000,5000]){
  await d.exec('truncate public.household_records cascade');await d.query("insert into public.household_records(household_id,bucket,key,value) select $1,'stock','Synthetic item '||lpad(i::text,5,'0'),case when i%2=0 then 'null'::jsonb else '2'::jsonb end from generate_series(1,$2::int) i",[householdId,n]);await d.exec('analyze public.household_records');await d.exec('set role authenticated');await measure('household_records_rls_'+n,'select bucket,key,value,revision from public.household_records where household_id=$1 order by bucket,key limit 1000 offset 0',[householdId]);await d.exec('reset role');
 }
 for(const n of [31,1000,5000]){
  if(n>31)await d.query("insert into public.recipe_documents(id,owner_id,content_hash,content,published,source) select gen_random_uuid(),null,'synthetic-'||$1||'-'||i,jsonb_build_object('title','Synthetic recipe '||i,'summary','Audit','minutes',20,'ingredients',jsonb_build_array()),true,'audit' from generate_series(1,$2::int) i",[n,n===1000?969:4000]);await d.exec('analyze public.recipe_documents');await measure('recipe_feed_'+n,"select public.recipe_feed(0,24,'','')");await measure('recipe_search_'+n,"select public.recipe_feed(0,24,'999','')");
 }
}catch(e){r.error={message:e.message,stack:e.stack}}finally{fs.writeFileSync(path.join(dir,'database.json'),JSON.stringify(r,null,2));await f.close();console.log('DATABASE_RUN='+dir);console.log(JSON.stringify(r.samples.map(s=>({label:s.label,min:Math.min(...s.samplesMs),max:Math.max(...s.samplesMs),bytes:s.jsonBytes})),null,2))}
