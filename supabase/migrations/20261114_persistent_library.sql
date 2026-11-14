-- Additive account-owned chats and immutable recipes. No household records change.
create table if not exists public.recipe_documents (
 id uuid primary key, owner_id uuid references auth.users(id) on delete cascade,
 content_hash text not null, content jsonb not null, tags text[] not null default '{}',
 published boolean not null default false, source text not null default 'personal',
 created_at timestamptz not null default now(),
 check(jsonb_typeof(content)='object'), unique(owner_id,content_hash)
);
create table if not exists public.recipe_library_entries (
 user_id uuid references auth.users(id) on delete cascade, recipe_id uuid references public.recipe_documents(id) on delete cascade,
 favourite boolean not null default false, status text not null default 'saved' check(status in ('saved','started','completed')),
 updated_at timestamptz not null default now(), primary key(user_id,recipe_id)
);
create table if not exists public.conversations (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 metadata jsonb not null default '{}', revision bigint not null default 1,
 updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.conversation_private_context(conversation_id uuid primary key references public.conversations(id) on delete cascade,parent_id text);
alter table public.conversation_private_context enable row level security;
revoke all on public.conversation_private_context from public,anon,authenticated;
insert into public.conversation_private_context select id,metadata->>'parentId' from public.conversations where metadata ? 'parentId' on conflict do nothing;
update public.conversations set metadata=metadata-'parentId' where metadata ? 'parentId';
create table if not exists public.conversation_messages (
 id uuid primary key, conversation_id uuid not null references public.conversations(id) on delete cascade,
 sequence bigint generated always as identity, body jsonb not null, created_at timestamptz not null default now()
);
create index if not exists conversation_messages_page on public.conversation_messages(conversation_id,sequence desc);
create index if not exists conversations_owner_page on public.conversations(owner_id,updated_at desc,id);
create table if not exists public.conversation_shares (
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 household_id uuid not null references public.households(id) on delete cascade, created_at timestamptz not null default now()
);
create table if not exists public.conversation_recipe_links (
 conversation_id uuid references public.conversations(id) on delete cascade, recipe_id uuid references public.recipe_documents(id) on delete cascade,
 primary key(conversation_id,recipe_id)
);
create table if not exists public.recipe_asset_jobs (
 recipe_id uuid references public.recipe_documents(id) on delete cascade, step integer not null,
 state text not null check(state in ('pending','ready','failed','uncertain')), lease uuid,
 asset_path text, bucket text not null default 'recipe-images', model text,
 updated_at timestamptz not null default now(), primary key(recipe_id,step)
);
alter table public.recipe_asset_jobs add column if not exists thumbnail_path text;
create table if not exists public.recipe_asset_usage (day date not null, scope text not null, calls integer not null default 0, primary key(day,scope));

create or replace function public.can_read_conversation(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.conversations c where c.id=cid and c.deleted_at is null and (c.owner_id=auth.uid() or exists(select 1 from public.conversation_shares s where s.conversation_id=c.id and public.is_household_member(s.household_id))));
$$;
create or replace function public.can_read_recipe(rid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.recipe_documents r where r.id=rid and (r.published or r.owner_id=auth.uid() or exists(select 1 from public.conversation_recipe_links l where l.recipe_id=r.id and public.can_read_conversation(l.conversation_id))));
$$;

alter table public.recipe_documents enable row level security;
alter table public.recipe_library_entries enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_shares enable row level security;
alter table public.conversation_recipe_links enable row level security;
alter table public.recipe_asset_jobs enable row level security;
alter table public.recipe_asset_usage enable row level security;
drop policy if exists recipe_document_read on public.recipe_documents;
create policy recipe_document_read on public.recipe_documents for select to anon,authenticated using(public.can_read_recipe(id));
drop policy if exists recipe_library_read on public.recipe_library_entries;
create policy recipe_library_read on public.recipe_library_entries for select to authenticated using(user_id=auth.uid() and public.can_read_recipe(recipe_id));
drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations for select to authenticated using(public.can_read_conversation(id));
drop policy if exists messages_read on public.conversation_messages;
create policy messages_read on public.conversation_messages for select to authenticated using(public.can_read_conversation(conversation_id));
drop policy if exists shares_read on public.conversation_shares;
create policy shares_read on public.conversation_shares for select to authenticated using(public.can_read_conversation(conversation_id));
drop policy if exists links_read on public.conversation_recipe_links;
create policy links_read on public.conversation_recipe_links for select to authenticated using(public.can_read_conversation(conversation_id));
revoke all on public.recipe_documents,public.recipe_library_entries,public.conversations,public.conversation_messages,public.conversation_shares,public.conversation_recipe_links,public.recipe_asset_jobs,public.recipe_asset_usage from public,anon,authenticated;
grant select on public.recipe_documents to anon,authenticated;
grant select on public.recipe_library_entries,public.conversations,public.conversation_messages,public.conversation_shares,public.conversation_recipe_links to authenticated;
grant all on public.recipe_documents,public.recipe_asset_jobs,public.recipe_asset_usage to service_role;

create or replace function public.save_recipe_document(rid uuid, recipe jsonb, labels text[] default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid; digest text; begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if rid is null or jsonb_typeof(recipe)<>'object' or octet_length(recipe::text)>20000 or length(recipe->>'title') not between 1 and 100 or length(recipe->>'summary') not between 1 and 400 or jsonb_typeof(recipe->'ingredients') is distinct from 'array' or jsonb_array_length(recipe->'ingredients') not between 1 and 15 or jsonb_typeof(recipe->'steps') is distinct from 'array' or jsonb_array_length(recipe->'steps') not between 1 and 6 or coalesce((recipe->>'minutes')::int,0) not between 1 and 240 then raise exception 'Invalid recipe';end if;
 if jsonb_typeof(recipe->'title') is distinct from 'string' or jsonb_typeof(recipe->'summary') is distinct from 'string' or exists(select 1 from jsonb_array_elements(recipe->'ingredients') i where jsonb_typeof(i->'name') is distinct from 'string' or jsonb_typeof(i->'amount') is distinct from 'string' or length(i->>'name') not between 1 and 80 or length(i->>'amount') not between 1 and 80) or exists(select 1 from jsonb_array_elements(recipe->'steps') s where jsonb_typeof(s) is distinct from 'string' or length(s#>>'{}') not between 1 and 500) or array_length(labels,1)>12 then raise exception 'Invalid recipe';end if;
 recipe=recipe-'recipeId'-'curated';digest=encode(sha256(convert_to(recipe::text,'UTF8')),'hex');
 select id into existing from public.recipe_documents where owner_id=auth.uid() and content_hash=digest; if found then return existing;end if;
 if exists(select 1 from public.recipe_documents where id=rid) then
  if exists(select 1 from public.recipe_documents where id=rid and content_hash=digest and public.can_read_recipe(id)) then return rid;end if;
  raise exception 'Recipe identity conflict';
 end if;
 insert into public.recipe_documents(id,owner_id,content_hash,content,tags) values(rid,auth.uid(),digest,recipe,labels) on conflict(owner_id,content_hash) do nothing;
 select id into existing from public.recipe_documents where owner_id=auth.uid() and content_hash=digest;return existing;
end $$;
create or replace function public.set_recipe_library(rid uuid, liked boolean, cooking_status text default 'saved') returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_read_recipe(rid) then raise exception 'Recipe access denied';end if;
 if cooking_status not in ('saved','started','completed') then raise exception 'Invalid status';end if;
 insert into public.recipe_library_entries(user_id,recipe_id,favourite,status) values(auth.uid(),rid,liked,cooking_status)
 on conflict(user_id,recipe_id) do update set favourite=excluded.favourite,status=case when excluded.status='saved' then public.recipe_library_entries.status else excluded.status end,updated_at=now();
end $$;
create or replace function public.recipe_feed(page_offset integer default 0, page_size integer default 24, search_text text default '', tag text default '') returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',content->>'title','summary',content->>'summary','minutes',(content->>'minutes')::int,'tags',tags,'ingredients',content->'ingredients','image',case when j.state='ready' and j.bucket='recipe-catalog' then coalesce(j.thumbnail_path,j.asset_path) else null end) order by r.created_at,r.id),'[]') from (select * from public.recipe_documents where published and (search_text='' or content->>'title' ilike '%'||left(search_text,100)||'%') and (tag='' or tag=any(tags)) order by created_at,id limit least(greatest(page_size,1),48) offset greatest(page_offset,0)) r left join public.recipe_asset_jobs j on j.recipe_id=r.id and j.step=-1;
$$;

create or replace function public.sync_conversation(cid uuid, meta jsonb, expected bigint, items jsonb default '[]', recipe_ids uuid[] default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.conversations; base_revision bigint; parent text; m jsonb; old public.conversation_messages; rid uuid; seq bigint; begin
 if auth.uid() is null or cid is null then raise exception 'Sign in required';end if;
 if octet_length(meta::text)>25000 or jsonb_typeof(meta) is distinct from 'object' or jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>50 then raise exception 'Invalid conversation';end if;
 parent=meta->>'parentId';meta=meta-'parentId';
 insert into public.conversations(id,owner_id,metadata) values(cid,auth.uid(),meta) on conflict do nothing;
 select * into c from public.conversations where id=cid for update;
 base_revision=c.revision;
 if c.owner_id<>auth.uid() or c.deleted_at is not null then raise exception 'Conversation access denied';end if;
 if parent is not null then insert into public.conversation_private_context values(cid,parent) on conflict(conversation_id) do update set parent_id=excluded.parent_id;end if;
 if c.metadata<>meta then
  if expected<>base_revision then raise exception 'Conflict: refresh conversation' using errcode='40001';end if;
  update public.conversations set metadata=meta,revision=revision+1 where id=cid returning * into c;
 end if;
 foreach rid in array recipe_ids loop
  if not exists(select 1 from public.recipe_documents where id=rid and (owner_id=auth.uid() or published)) then raise exception 'Recipe access denied';end if;
  insert into public.conversation_recipe_links values(cid,rid) on conflict do nothing;
 end loop;
 for m in select * from jsonb_array_elements(items) loop
  if octet_length(m::text)>40000 or length(m->>'text') not between 1 and 10000 or m->>'role' not in ('user','model') or m->>'id' is null then raise exception 'Invalid message';end if;
  if m ? 'photoPath' and m->>'photoPath' is distinct from auth.uid()::text||'/'||cid::text||'/'||(m->>'id')||'.jpg' then raise exception 'Invalid photo reference';end if;
  select * into old from public.conversation_messages where id=(m->>'id')::uuid;
  if found then
   if old.conversation_id<>cid or (old.body-'result'-'photoPath')<>(m-'id'-'result'-'photoPath') then raise exception 'Message identity conflict';end if;
   -- Only a receipt is mutable, guarded by its previous value. Never replay an action.
   if old.body->'result' is distinct from m->'result' or old.body->'photoPath' is distinct from m->'photoPath' then
    if m ? 'photoPath' and (m->>'photoPath' not like auth.uid()::text||'/'||cid::text||'/'||old.id::text||'.jpg' or old.body ? 'photoPath' and old.body->'photoPath'<>m->'photoPath') then raise exception 'Invalid photo reference';end if;
    if expected<>base_revision then raise exception 'Conflict: refresh conversation' using errcode='40001';end if;
    update public.conversation_messages set body=m-'id' where id=old.id;
    update public.conversations set revision=revision+1 where id=cid returning * into c;
   end if;
  else
   insert into public.conversation_messages(id,conversation_id,body,created_at) values((m->>'id')::uuid,cid,m-'id',coalesce(to_timestamp((m->>'createdAt')::numeric/1000),now()));
  end if;
 end loop;
 if jsonb_array_length(items)>0 then update public.conversations set updated_at=now() where id=cid;end if;
 select max(sequence) into seq from public.conversation_messages where conversation_id=cid;
 return jsonb_build_object('revision',c.revision,'sequence',coalesce(seq,0));
end $$;
create table if not exists public.conversation_user_state(user_id uuid references auth.users(id) on delete cascade, conversation_id uuid references public.conversations(id) on delete cascade, archived_at timestamptz, primary key(user_id,conversation_id));
alter table public.conversation_user_state enable row level security;
revoke all on public.conversation_user_state from public,anon,authenticated;
create or replace function public.archive_shared_conversation(cid uuid, archived boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_read_conversation(cid) then raise exception 'Conversation access denied';end if;
 insert into public.conversation_user_state values(auth.uid(),cid,case when archived then now() else null end) on conflict(user_id,conversation_id) do update set archived_at=excluded.archived_at;
end $$;
revoke all on function public.archive_shared_conversation(uuid,boolean) from public;
grant execute on function public.archive_shared_conversation(uuid,boolean) to authenticated;
create or replace function public.conversation_index(page_offset int default 0) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'owner',c.owner_id=auth.uid(),'metadata',case when c.owner_id=auth.uid() then c.metadata||coalesce((select jsonb_build_object('parentId',p.parent_id) from public.conversation_private_context p where p.conversation_id=c.id),'{}'::jsonb) else (c.metadata-'parentId'-'archivedAt')||case when u.archived_at is not null then jsonb_build_object('archivedAt',extract(epoch from u.archived_at)*1000) else '{}'::jsonb end end,'revision',c.revision,'updated',extract(epoch from c.updated_at)*1000,'sharedHousehold',s.household_id) order by c.updated_at desc,c.id),'[]') from (select * from public.conversations where public.can_read_conversation(id) order by updated_at desc,id limit 100 offset greatest(page_offset,0)) c left join public.conversation_shares s on s.conversation_id=c.id left join public.conversation_user_state u on u.conversation_id=c.id and u.user_id=auth.uid();
$$;
create or replace function public.conversation_page(cid uuid, before_seq bigint default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare data jsonb; first_seq bigint; begin
 if not public.can_read_conversation(cid) then raise exception 'Conversation access denied';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'sequence',m.sequence,'body',m.body) order by m.sequence),'[]'),min(sequence) into data,first_seq from (select * from public.conversation_messages where conversation_id=cid and (before_seq is null or sequence<before_seq) order by sequence desc limit 50) m;
 return jsonb_build_object('messages',data,'before',first_seq,'hasOlder',exists(select 1 from public.conversation_messages where conversation_id=cid and sequence<first_seq));
end $$;
create or replace function public.share_conversation(cid uuid, hid uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.conversations where id=cid and owner_id=auth.uid() and deleted_at is null for update;if not found then raise exception 'Conversation access denied';end if;
 if hid is null then delete from public.conversation_shares where conversation_id=cid;
 else
  perform 1 from public.households where id=hid for update;
  if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
  insert into public.conversation_shares(conversation_id,household_id) values(cid,hid) on conflict(conversation_id) do update set household_id=excluded.household_id,created_at=now();
 end if;update public.conversations set updated_at=now() where id=cid;
end $$;
create or replace function public.delete_conversation(cid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.conversations set deleted_at=now(),revision=revision+1 where id=cid and owner_id=auth.uid();if not found then raise exception 'Conversation access denied';end if;
 delete from public.conversation_shares where conversation_id=cid;
end $$;

-- Only service can claim images. Public IDs, global + personal budgets and fencing.
create or replace function public.claim_recipe_asset(rid uuid, image_step int, user_id uuid, image_model text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.recipe_asset_jobs; d date:=(now() at time zone 'UTC')::date; total int; personal int; token uuid; begin
 if user_id is null or image_step not between -1 and 5 or not exists(select 1 from public.recipe_documents where id=rid) then raise exception 'Invalid image request';end if;
 perform 1 from public.recipe_documents where id=rid for update;
 select * into j from public.recipe_asset_jobs where recipe_id=rid and step=image_step;
 if j.state='ready' then return jsonb_build_object('status','ready');end if;
 if j.state='uncertain' then return jsonb_build_object('status','uncertain');end if;
 if j.state='pending' then
  -- A timed-out provider may still bill/finish. Never steal an uncertain generation.
  if j.updated_at<now()-interval '3 minutes' then update public.recipe_asset_jobs set state='uncertain' where recipe_id=rid and step=image_step;return jsonb_build_object('status','uncertain');end if;
  return jsonb_build_object('status','pending');
 end if;
 if j.state='failed' and j.updated_at>now()-interval '1 minute' then return jsonb_build_object('status','cooldown');end if;
 insert into public.recipe_asset_usage values(d,'global',0) on conflict do nothing;select calls into total from public.recipe_asset_usage where day=d and scope='global' for update;
 insert into public.recipe_asset_usage values(d,user_id::text,0) on conflict do nothing;select calls into personal from public.recipe_asset_usage where day=d and scope=user_id::text for update;
 if total>=50 or personal>=20 then return jsonb_build_object('status','limit');end if;
 token:=gen_random_uuid();update public.recipe_asset_usage set calls=calls+1 where day=d and scope in ('global',user_id::text);
 insert into public.recipe_asset_jobs(recipe_id,step,state,lease,model) values(rid,image_step,'pending',token,image_model) on conflict(recipe_id,step) do update set state='pending',lease=token,model=image_model,updated_at=now();
 return jsonb_build_object('status','claimed','lease',token);
end $$;
revoke all on function public.can_read_conversation(uuid),public.can_read_recipe(uuid),public.save_recipe_document(uuid,jsonb,text[]),public.set_recipe_library(uuid,boolean,text),public.recipe_feed(integer,integer,text,text),public.sync_conversation(uuid,jsonb,bigint,jsonb,uuid[]),public.conversation_index(integer),public.conversation_page(uuid,bigint),public.share_conversation(uuid,uuid),public.delete_conversation(uuid),public.claim_recipe_asset(uuid,integer,uuid,text) from public;
grant execute on function public.can_read_recipe(uuid),public.recipe_feed(integer,integer,text,text) to anon,authenticated;
grant execute on function public.can_read_conversation(uuid),public.save_recipe_document(uuid,jsonb,text[]),public.set_recipe_library(uuid,boolean,text),public.sync_conversation(uuid,jsonb,bigint,jsonb,uuid[]),public.conversation_index(integer),public.conversation_page(uuid,bigint),public.share_conversation(uuid,uuid),public.delete_conversation(uuid) to authenticated;
grant execute on function public.claim_recipe_asset(uuid,integer,uuid,text) to service_role;

do $$ begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('recipe-catalog','recipe-catalog',true,5242880,array['image/png','image/jpeg','image/webp']),('chat-media','chat-media',false,2097152,array['image/jpeg']) on conflict(id) do nothing;
  if exists(select 1 from storage.buckets where id='chat-media' and public=true) then raise exception 'chat-media must be private';end if;
  execute 'drop policy if exists chat_media_read on storage.objects';
  execute $p$create policy chat_media_read on storage.objects for select to authenticated using(bucket_id='chat-media' and public.can_read_conversation((string_to_array(name,'/'))[2]::uuid))$p$;
  execute 'drop policy if exists chat_media_write on storage.objects';
  execute $p$create policy chat_media_write on storage.objects for insert to authenticated with check(bucket_id='chat-media' and (string_to_array(name,'/'))[1]=auth.uid()::text and exists(select 1 from public.conversations c where c.id=(string_to_array(name,'/'))[2]::uuid and c.owner_id=auth.uid() and c.deleted_at is null))$p$;
 end if;
end $$;
notify pgrst,'reload schema';
alter table public.recipe_asset_jobs add column if not exists thumbnail_path text;

-- Own-device concurrency: one in-flight assistant turn, with a bounded lease.
create table if not exists public.conversation_turns(conversation_id uuid primary key references public.conversations(id) on delete cascade, turn_id uuid not null, expires_at timestamptz not null);
alter table public.conversation_turns enable row level security;
revoke all on public.conversation_turns from public,anon,authenticated;
create or replace function public.begin_conversation_turn(cid uuid, tid uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.conversations where id=cid and owner_id=auth.uid() and deleted_at is null for update;if not found then raise exception 'Conversation access denied';end if;
 if exists(select 1 from public.conversation_turns where conversation_id=cid and expires_at>now() and turn_id<>tid) then return false;end if;
 insert into public.conversation_turns values(cid,tid,now()+interval '150 seconds') on conflict(conversation_id) do update set turn_id=excluded.turn_id,expires_at=excluded.expires_at;return true;
end $$;
create or replace function public.end_conversation_turn(cid uuid, tid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.conversations where id=cid and owner_id=auth.uid()) then raise exception 'Conversation access denied';end if;
 delete from public.conversation_turns where conversation_id=cid and turn_id=tid;
end $$;
create or replace function public.clone_recipe_document(rid uuid,new_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.recipe_documents; cloned uuid;begin
 if auth.uid() is null or not public.can_read_recipe(rid) then raise exception 'Recipe access denied';end if;
 select * into r from public.recipe_documents where id=rid;if r.published or r.owner_id=auth.uid() then return rid;end if;
 cloned=public.save_recipe_document(new_id,r.content,r.tags);
 insert into public.recipe_asset_jobs(recipe_id,step,state,asset_path,bucket,model) select cloned,step,state,asset_path,bucket,model from public.recipe_asset_jobs where recipe_id=rid and state='ready' on conflict do nothing;
 return cloned;
end $$;
revoke all on function public.begin_conversation_turn(uuid,uuid),public.end_conversation_turn(uuid,uuid),public.clone_recipe_document(uuid,uuid) from public;
grant execute on function public.begin_conversation_turn(uuid,uuid),public.end_conversation_turn(uuid,uuid),public.clone_recipe_document(uuid,uuid) to authenticated;
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversations') then alter publication supabase_realtime add table public.conversations;end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversation_shares') then alter publication supabase_realtime add table public.conversation_shares;end if;
 end if;
end $$;
