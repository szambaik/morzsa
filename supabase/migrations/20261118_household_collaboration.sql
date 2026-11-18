-- Household recipes are shared deliberately by authenticated clients. Ordinary
-- conversations and existing RPC signatures keep their private-by-default behavior.
begin;
create table if not exists public.household_recipe_entries (
 household_id uuid not null references public.households(id) on delete cascade,
 recipe_id uuid not null references public.recipe_documents(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 favourite boolean not null default false,
 status text not null default 'saved' check(status in ('saved','started','completed')),
 updated_at timestamptz not null default now(),
 primary key(household_id,recipe_id,user_id)
);
create table if not exists public.household_member_names (
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 1 and 60 and display_name !~ '[[:cntrl:]]'),
 primary key(household_id,user_id)
);
create table if not exists public.household_change_receipts (
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, created_at timestamptz not null default now(),
 primary key(household_id,user_id,request_id)
);
create index if not exists household_recipe_recent on public.household_recipe_entries(household_id,updated_at desc);
alter table public.household_recipe_entries enable row level security;
alter table public.household_member_names enable row level security;
alter table public.household_change_receipts enable row level security;
drop policy if exists household_recipes_read on public.household_recipe_entries;
create policy household_recipes_read on public.household_recipe_entries for select to authenticated using(public.is_household_member(household_id));
drop policy if exists household_names_read on public.household_member_names;
create policy household_names_read on public.household_member_names for select to authenticated using(public.is_household_member(household_id));
revoke all on public.household_recipe_entries,public.household_member_names,public.household_change_receipts from public,anon,authenticated;
grant select on public.household_recipe_entries,public.household_member_names to authenticated;

create or replace function public.can_read_recipe(rid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.recipe_documents r where r.id=rid and (r.published or r.owner_id=auth.uid()
  or exists(select 1 from public.conversation_recipe_links l where l.recipe_id=r.id and public.can_read_conversation(l.conversation_id))
  or exists(select 1 from public.household_recipe_entries e where e.recipe_id=r.id and public.is_household_member(e.household_id))));
$$;

create or replace function public.set_household_recipe_library(hid uuid,rid uuid,liked boolean,cooking_status text default 'saved') returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if liked is null or cooking_status is null or cooking_status not in ('saved','started','completed') or not public.can_read_recipe(rid) then raise exception 'Recipe access denied';end if;
 perform public.set_recipe_library(rid,liked,cooking_status);
 insert into public.household_recipe_entries(household_id,recipe_id,user_id,favourite,status) values(hid,rid,auth.uid(),liked,cooking_status)
 on conflict(household_id,recipe_id,user_id) do update set favourite=excluded.favourite,
  status=case when excluded.status='saved' then public.household_recipe_entries.status else excluded.status end,updated_at=now();
end $$;

create or replace function public.share_household_recipe_conversation(hid uuid,cid uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.conversations;rid uuid;begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 select * into c from public.conversations where id=cid for update;
 if c.owner_id is distinct from auth.uid() or c.deleted_at is not null or c.metadata->>'kind' is distinct from 'recipe' then raise exception 'Recipe conversation access denied';end if;
 -- Never move a conversation already shared with a different household.
 if exists(select 1 from public.conversation_shares where conversation_id=cid and household_id<>hid) then raise exception 'Recipe belongs to another household';end if;
 rid:=nullif(c.metadata->'recipe'->>'recipeId','')::uuid;
 if rid is null or not exists(select 1 from public.conversation_recipe_links where conversation_id=cid and recipe_id=rid) then raise exception 'Recipe sync pending';end if;
 perform public.set_household_recipe_library(hid,rid,coalesce((select favourite from public.recipe_library_entries where user_id=auth.uid() and recipe_id=rid),false),case when c.metadata->>'status'='completed' then 'completed' else 'started' end);
 insert into public.conversation_shares(conversation_id,household_id) values(cid,hid) on conflict do nothing;
end $$;

-- An explicit privacy choice survives later cooking-progress saves and adoption.
create or replace function public.share_conversation(cid uuid,hid uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare c public.conversations;begin
 select * into c from public.conversations where id=cid and owner_id=auth.uid() and deleted_at is null for update;
 if c.id is null then raise exception 'Conversation access denied';end if;
 if hid is null then delete from public.conversation_shares where conversation_id=cid;
 else
  if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
  insert into public.conversation_shares(conversation_id,household_id) values(cid,hid) on conflict(conversation_id) do update set household_id=excluded.household_id;
 end if;
 if c.metadata->>'kind'='recipe' and c.metadata->'recipeHousehold' is distinct from coalesce(to_jsonb(hid),'null'::jsonb) then
  update public.conversations set metadata=metadata||jsonb_build_object('recipeHousehold',hid),revision=revision+1 where id=cid;
 end if;
end $$;

create or replace function public.household_recipe_index(hid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 select coalesce(jsonb_agg(jsonb_build_object('recipe_id',x.recipe_id,'favourite',x.favourite,'ownFavourite',x.own_favourite,'status',x.status,'recipe_documents',jsonb_build_object('id',r.id,'content',r.content,'tags',r.tags,'published',r.published)) order by x.updated_at desc,x.recipe_id),'[]') into result
 from (select recipe_id,bool_or(favourite) favourite,bool_or(favourite and user_id=auth.uid()) own_favourite,
  case when bool_or(status='started') then 'started' when bool_or(status='completed') then 'completed' else 'saved' end status,max(updated_at) updated_at
  from public.household_recipe_entries where household_id=hid group by recipe_id) x join public.recipe_documents r on r.id=x.recipe_id;
 return result;
end $$;

-- Adopt legacy started/favourite recipes once, into the first selected kitchen.
-- Recipes already attached elsewhere and ordinary chat history are excluded.
create or replace function public.adopt_household_recipes(hid uuid) returns void language plpgsql security definer set search_path='' as $$
declare r record;c record;begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 for r in select l.* from public.recipe_library_entries l where l.user_id=auth.uid() and (l.favourite or l.status in ('started','completed'))
  and not exists(select 1 from public.household_recipe_entries e where e.recipe_id=l.recipe_id and e.user_id=auth.uid())
  and not exists(select 1 from public.conversation_recipe_links k join public.conversation_shares s on s.conversation_id=k.conversation_id where k.recipe_id=l.recipe_id and s.household_id<>hid) loop
  perform public.set_household_recipe_library(hid,r.recipe_id,r.favourite,r.status);
 end loop;
 for c in select v.id from public.conversations v where v.owner_id=auth.uid() and v.deleted_at is null and v.metadata->>'kind'='recipe'
  and not (v.metadata ? 'recipeHousehold' and v.metadata->'recipeHousehold'='null'::jsonb)
  and exists(select 1 from public.household_recipe_entries e where e.household_id=hid and e.recipe_id::text=v.metadata->'recipe'->>'recipeId')
  and not exists(select 1 from public.conversation_shares s where s.conversation_id=v.id) loop
  perform public.share_household_recipe_conversation(hid,c.id);
 end loop;
end $$;

create or replace function public.household_member_label(hid uuid,uid uuid) returns text language sql stable security definer set search_path='' as $$
 select case when public.is_household_member(hid) then coalesce(
  (select display_name from public.household_member_names where household_id=hid and user_id=uid),
  (select left(coalesce(nullif(trim(to_jsonb(u)->'raw_user_meta_data'->>'full_name'),''),nullif(trim(to_jsonb(u)->'raw_user_meta_data'->>'name'),''),nullif(split_part(to_jsonb(u)->>'email','@',1),'')),60) from auth.users u where u.id=uid and exists(select 1 from public.household_members where household_id=hid and user_id=uid))) end;
$$;

create or replace function public.set_household_preferences(hid uuid,changes jsonb,display_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if display_name is null or length(trim(display_name)) not between 1 and 60 or display_name ~ '[[:cntrl:]]' then raise exception 'Invalid display name';end if;
 perform public.set_kitchen_preferences(hid,changes);
 insert into public.household_member_names(household_id,user_id,display_name) values(hid,auth.uid(),trim(display_name))
 on conflict(household_id,user_id) do update set display_name=excluded.display_name;
end $$;

create or replace function public.household_collaboration_snapshot(hid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare members jsonb;events jsonb;cooking jsonb;preferences jsonb;cooked jsonb;begin
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',public.household_member_label(hid,m.user_id)) order by m.user_id),'[]') into members from public.household_members m where household_id=hid;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('actor_name',public.household_member_label(hid,e.actor_id)) order by e.id desc),'[]') into events from (select id,actor_id,created_at,event_type,subject,item_count from public.household_kitchen_events where household_id=hid order by id desc limit 12) e;
 select coalesce(jsonb_agg(jsonb_build_object('conversationId',c.id,'recipeId',c.metadata->'recipe'->>'recipeId','title',c.metadata->'recipe'->>'title',
  'actorId',c.owner_id,'actorName',public.household_member_label(hid,c.owner_id),'step',c.metadata->'cookingStep','stepCount',jsonb_array_length(c.metadata->'recipe'->'steps'),
  'activity',case when c.metadata->'cooking'->>'activity'='paused' or c.updated_at<now()-interval '24 hours' then 'paused' when c.metadata->'cooking'->>'phase'='preparation' then 'preparation' else 'active' end,
  'updatedAt',c.updated_at) order by c.updated_at desc),'[]') into cooking
 from public.conversation_shares s join public.conversations c on c.id=s.conversation_id
 where s.household_id=hid and c.deleted_at is null and c.metadata->>'kind'='recipe' and c.metadata->>'status' is distinct from 'completed'
  and c.metadata->'cooking'->>'phase' is distinct from 'completion';
 select coalesce(jsonb_agg(jsonb_build_object('key',p.key,'value',p.value,'revision',p.revision)),'[]') into preferences from public.household_kitchen_preferences p where p.household_id=hid;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') into cooked from (select event_type,subject,created_at from public.household_kitchen_events where household_id=hid and event_type='recipe_completed' order by id desc limit 8) e;
 return jsonb_build_object('members',members,'events',events,'cooking',cooking,'preferences',preferences,'cooked',cooked);
end $$;

-- A normalized lookup under the existing household lock prevents case/spacing
-- aliases from becoming new records. Tombstones continue to guard old clients.
create or replace function public.household_product_key(product text) returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(trim(normalize(product,NFC)),'[[:space:]]+',' ','g'));
$$;

create index if not exists household_products_normalized on public.household_records(household_id,bucket,public.household_product_key(key)) where bucket in ('cart','custom');

create or replace function public.apply_household_changes(hid uuid, changes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c jsonb; actual bigint; canonical text; begin
 -- Serialize mutations in this household; checking membership after the lock prevents races.
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>3000 then raise exception 'Invalid changes';end if;
 for c in select * from jsonb_array_elements(changes) loop
  if octet_length(c::text)>100000 then raise exception 'Item too large';end if;
  if c->>'bucket' in ('cart','custom') then
   select key into canonical from public.household_records where household_id=hid and bucket=c->>'bucket' and public.household_product_key(key)=public.household_product_key(c->>'key') order by (key=c->>'key') desc,(value is not null) desc,revision desc limit 1;
   canonical:=coalesce(canonical,trim(c->>'key'));
   if c->'value' is not null and c->'value'<>'null'::jsonb and c->'value'->>'name' is distinct from c->>'key' then raise exception 'Invalid product';end if;
   c:=jsonb_set(c,'{key}',to_jsonb(canonical));
   if c->'value' is not null and c->'value'<>'null'::jsonb then c:=jsonb_set(c,'{value,name}',to_jsonb(canonical));end if;
  end if;
  if c->'value' is not null and c->'value'<>'null'::jsonb then
   if c->>'bucket'='stock' and c->'value' not in ('0'::jsonb,'1'::jsonb,'2'::jsonb) then raise exception 'Invalid stock';end if;
   if c->>'bucket' in ('cart','custom') and (jsonb_typeof(c->'value')<>'object' or c->'value'->>'name' is distinct from c->>'key') then raise exception 'Invalid product';end if;
   if c->>'bucket'='cart' and (coalesce((c->'value'->>'quantity')::numeric,1)<1 or coalesce((c->'value'->>'quantity')::numeric,1)>100000) then raise exception 'Invalid quantity';end if;
   if c->>'bucket'='custom' and c->'value'->>'category' is distinct from 'Saját tételek' then raise exception 'Invalid custom category';end if;
   if c->>'bucket'='history' and (c->'value'->>'id' is distinct from c->>'key' or jsonb_typeof(c->'value'->'items') is distinct from 'array' or jsonb_typeof(c->'value'->'date') is distinct from 'string') then raise exception 'Invalid archive';end if;
  end if;
  select revision into actual from public.household_records where household_id=hid and bucket=c->>'bucket' and key=c->>'key';
  actual=coalesce(actual,0);
  if actual<> (c->>'expected')::bigint or c->>'expected' is null then raise exception 'Conflict: refresh and retry' using errcode='40001';end if;
  insert into public.household_records(household_id,bucket,key,value,revision) values(hid,c->>'bucket',c->>'key',nullif(c->'value','null'::jsonb),actual+1)
  on conflict(household_id,bucket,key) do update set value=excluded.value,revision=excluded.revision;
 end loop;
end $$;

-- Shared recipes keep their immutable IDs and cached assets in a member’s own cooking thread.
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
  update public.conversations set metadata=meta,revision=revision+1,updated_at=now() where id=cid returning * into c;
 end if;
 foreach rid in array recipe_ids loop
  if not public.can_read_recipe(rid) then raise exception 'Recipe access denied';end if;
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

create or replace function public.apply_household_changes_once(hid uuid,request_id uuid,changes jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) or request_id is null then raise exception 'Household access denied';end if;
 if exists(select 1 from public.household_change_receipts r where r.household_id=hid and r.user_id=auth.uid() and r.request_id=apply_household_changes_once.request_id) then return jsonb_build_object('applied',true,'replayed',true);end if;
 perform public.apply_household_changes(hid,changes);
 insert into public.household_change_receipts(household_id,user_id,request_id) values(hid,auth.uid(),apply_household_changes_once.request_id);
 return jsonb_build_object('applied',true,'replayed',false);
end $$;

revoke all on function public.set_household_recipe_library(uuid,uuid,boolean,text),public.share_household_recipe_conversation(uuid,uuid),public.household_recipe_index(uuid),public.adopt_household_recipes(uuid),public.household_member_label(uuid,uuid),public.set_household_preferences(uuid,jsonb,text),public.household_collaboration_snapshot(uuid),public.household_product_key(text),public.apply_household_changes_once(uuid,uuid,jsonb) from public,anon;
grant execute on function public.set_household_recipe_library(uuid,uuid,boolean,text),public.share_household_recipe_conversation(uuid,uuid),public.household_recipe_index(uuid),public.adopt_household_recipes(uuid),public.set_household_preferences(uuid,jsonb,text),public.household_collaboration_snapshot(uuid),public.apply_household_changes_once(uuid,uuid,jsonb) to authenticated;

do $$ declare n text;begin
 foreach n in array array['household_recipe_entries','household_member_names'] loop
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=n) then execute format('alter publication supabase_realtime add table public.%I',n);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
