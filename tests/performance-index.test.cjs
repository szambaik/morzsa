const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('indexed conversation candidates preserve ownership, shares, archive privacy, deletion and pagination',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
 await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));const original=fs.readFileSync('supabase/migrations/20261114_persistent_library.sql','utf8');await db.exec(original);
 const start=original.indexOf('create or replace function public.conversation_index('),end=original.indexOf('\n$$;',start)+4;await db.exec(original.slice(start,end).replace('public.conversation_index','public.audit_original_index'));
 const change=fs.readFileSync('supabase/migrations/20261116_performance_index.sql','utf8');await db.exec(change);await db.exec(change);
 const ids=[1,2,3].map(i=>'00000000-0000-4000-8000-00000000000'+i),hid='90000000-0000-4000-8000-000000000001',other='90000000-0000-4000-8000-000000000002';
 for(const id of ids)await db.query('insert into auth.users values($1)',[id]);
 await db.query("insert into public.households(id,name,owner_id) values($1,'One',$3),($2,'Two',$4)",[hid,other,ids[0],ids[2]]);
 await db.query('insert into public.household_members values($1,$3),($1,$4),($2,$5)',[hid,other,...ids]);
 await db.query("insert into public.conversations(id,owner_id,metadata,updated_at,deleted_at) select ('10000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,case when g<=150 then $1::uuid when g<=200 then $2::uuid else $3::uuid end,jsonb_build_object('title','Chat '||g,'archivedAt',1),now()-(g||' seconds')::interval,case when g=1 then now() else null end from generate_series(1,5000) g",ids);
 await db.query("insert into public.conversation_shares select id,case when metadata->>'title'='Chat 160' then $2::uuid else $1::uuid end,now() from public.conversations where (right(id::text,12))::int between 140 and 170",[hid,other]);
 await db.exec("insert into public.conversation_private_context select id,'private-parent' from public.conversations");
 const compare=async()=>{for(const id of [...ids,'']){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);for(const offset of [-1,0,100,200]){const r=await db.query('select public.conversation_index($1) actual,public.audit_original_index($1) expected',[offset]);assert.deepEqual(r.rows[0].actual,r.rows[0].expected)}}};
 await compare();await db.query('delete from public.household_members where household_id=$1 and user_id=$2',[hid,ids[1]]);await compare();
 await db.query("update public.conversations set deleted_at=now() where owner_id=$1",[ids[0]]);await compare();
 }finally{await db.close()}
});
