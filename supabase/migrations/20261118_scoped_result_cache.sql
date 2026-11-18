-- Private, versioned result cache. Clients never read this table directly.
create table if not exists public.household_cache_versions (
 household_id uuid primary key references public.households(id) on delete cascade,
 revision bigint not null default 1
);
create table if not exists public.morzsa_result_cache (
 user_id uuid not null references auth.users(id) on delete cascade,
 household_id uuid references public.households(id) on delete cascade,
 scope_key text not null,
 request_type text not null,
 input_hash text not null check(input_hash ~ '^[a-f0-9]{64}$'),
 model_key text not null,
 data_version bigint not null,
 payload jsonb not null check(octet_length(payload::text)<=524288),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 primary key(user_id,scope_key,request_type,input_hash,model_key)
);
create index if not exists morzsa_result_cache_expiry on public.morzsa_result_cache(expires_at);
alter table public.household_cache_versions enable row level security;
alter table public.morzsa_result_cache enable row level security;
revoke all on public.household_cache_versions,public.morzsa_result_cache from public,anon,authenticated;

create or replace function public.bump_household_cache_version() returns trigger language plpgsql security definer set search_path='' as $$
declare h uuid;old_h uuid;begin
 if tg_table_name='households' then h=case when tg_op='DELETE' then old.id else new.id end;
 else h=case when tg_op='DELETE' then old.household_id else new.household_id end;
  if tg_op='UPDATE' then old_h=old.household_id;end if;
 end if;
 if exists(select 1 from public.households where id=h) then
  insert into public.household_cache_versions values(h,1) on conflict(household_id) do update set revision=public.household_cache_versions.revision+1;
 end if;
 if old_h is distinct from h and exists(select 1 from public.households where id=old_h) then
  insert into public.household_cache_versions values(old_h,1) on conflict(household_id) do update set revision=public.household_cache_versions.revision+1;
 end if;
 return null;
end $$;
do $$ declare t text;begin
 foreach t in array array['households','household_members','household_records','household_kitchen_preferences','household_kitchen_events','household_recipe_entries','household_member_names','household_pantry_reviews','household_shopping_sessions','household_shopping_routes','conversation_shares'] loop
  execute format('drop trigger if exists morzsa_cache_version on public.%I',t);
  execute format('create trigger morzsa_cache_version after insert or update or delete on public.%I for each row execute function public.bump_household_cache_version()',t);
 end loop;
end $$;
create or replace function public.bump_conversation_cache_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.household_cache_versions(household_id,revision)
 select distinct s.household_id,1 from public.conversation_shares s where s.conversation_id=case when tg_op='DELETE' then old.id else new.id end
 on conflict(household_id) do update set revision=public.household_cache_versions.revision+1;
 return null;
end $$;
drop trigger if exists morzsa_cache_version on public.conversations;
create trigger morzsa_cache_version after update or delete on public.conversations for each row execute function public.bump_conversation_cache_version();
create or replace function public.bump_member_profile_cache_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.household_cache_versions(household_id,revision) select household_id,1 from public.household_members where user_id=new.id
 on conflict(household_id) do update set revision=public.household_cache_versions.revision+1;return null;
end $$;
drop trigger if exists morzsa_cache_profile_version on auth.users;
create trigger morzsa_cache_profile_version after update of raw_user_meta_data on auth.users for each row execute function public.bump_member_profile_cache_version();

create or replace function public.get_morzsa_result_cache(p_user_id uuid,p_hid uuid,p_request_type text,p_input_hash text,p_model_key text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v bigint:=0;result jsonb;begin
 if p_hid is not null then
  if not exists(select 1 from public.household_members where household_id=p_hid and user_id=p_user_id) then raise exception 'Household access denied';end if;
  select coalesce((select revision from public.household_cache_versions where household_id=p_hid),0) into v;
 end if;
 select payload into result from public.morzsa_result_cache where user_id=p_user_id and scope_key=coalesce(p_hid::text,'personal') and request_type=p_request_type and input_hash=p_input_hash and model_key=p_model_key and data_version=v and expires_at>now();
 return jsonb_build_object('version',v,'payload',result);
end $$;
create or replace function public.put_morzsa_result_cache(p_user_id uuid,p_hid uuid,p_request_type text,p_input_hash text,p_model_key text,p_data_version bigint,p_payload jsonb,p_ttl_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare v bigint:=0;begin
 if p_request_type not in ('recipe_recommendations','assistant_text','ingredient_recognition','household_dashboard') or length(p_model_key)>200 or p_input_hash !~ '^[a-f0-9]{64}$' or p_payload is null or octet_length(p_payload::text)>524288 then return false;end if;
 -- Match household mutation lock order; membership and version cannot change
 -- between checking access and committing a cached result.
 if p_hid is not null then
  perform 1 from public.households where id=p_hid for update;
  if not exists(select 1 from public.household_members where household_id=p_hid and user_id=p_user_id) then return false;end if;
  select coalesce((select revision from public.household_cache_versions where household_id=p_hid),0) into v;
 end if;
 if v<>p_data_version then return false;end if;
 delete from public.morzsa_result_cache where user_id=p_user_id and expires_at<=now();
 insert into public.morzsa_result_cache(user_id,household_id,scope_key,request_type,input_hash,model_key,data_version,payload,expires_at)
 values(p_user_id,p_hid,coalesce(p_hid::text,'personal'),p_request_type,p_input_hash,p_model_key,v,p_payload,now()+make_interval(secs=>greatest(1,least(coalesce(p_ttl_seconds,60),86400))))
 on conflict(user_id,scope_key,request_type,input_hash,model_key) do update set data_version=excluded.data_version,payload=excluded.payload,expires_at=excluded.expires_at,created_at=now();
 delete from public.morzsa_result_cache where user_id=p_user_id and (scope_key,request_type,input_hash,model_key) in
 (select scope_key,request_type,input_hash,model_key from public.morzsa_result_cache where user_id=p_user_id order by created_at desc,scope_key,request_type,input_hash,model_key offset 128);
 return true;
end $$;
revoke all on function public.get_morzsa_result_cache(uuid,uuid,text,text,text),public.put_morzsa_result_cache(uuid,uuid,text,text,text,bigint,jsonb,integer),public.bump_household_cache_version(),public.bump_conversation_cache_version(),public.bump_member_profile_cache_version() from public,anon,authenticated;
grant execute on function public.get_morzsa_result_cache(uuid,uuid,text,text,text),public.put_morzsa_result_cache(uuid,uuid,text,text,text,bigint,jsonb,integer) to service_role;

-- Keep the original response contract and permission check. Copy the original
-- aggregation once so applying this migration again never wraps the wrapper.
do $$ begin
 if to_regprocedure('public.household_collaboration_snapshot_source(uuid)') is null then
  execute replace(pg_get_functiondef('public.household_collaboration_snapshot(uuid)'::regprocedure),'public.household_collaboration_snapshot(', 'public.household_collaboration_snapshot_source(');
 end if;
end $$;
revoke all on function public.household_collaboration_snapshot_source(uuid) from public,anon,authenticated;
create or replace function public.household_collaboration_snapshot(hid uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare hit jsonb;result jsonb;begin
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 hit:=public.get_morzsa_result_cache(auth.uid(),hid,'household_dashboard',repeat('0',64),'dashboard-v1');
 if hit->'payload' is not null and hit->'payload'<>'null'::jsonb then return hit->'payload';end if;
 result:=public.household_collaboration_snapshot_source(hid);
 perform public.put_morzsa_result_cache(auth.uid(),hid,'household_dashboard',repeat('0',64),'dashboard-v1',(hit->>'version')::bigint,result,30);
 return result;
end $$;
revoke all on function public.household_collaboration_snapshot(uuid) from public,anon;
grant execute on function public.household_collaboration_snapshot(uuid) to authenticated;
