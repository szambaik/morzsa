-- Run once in a new Supabase project's SQL editor.
create table public.households (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 80),
 owner_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.household_members (
 household_id uuid references public.households(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 primary key(household_id,user_id)
);
create table public.household_invites (
 token_hash bytea primary key, household_id uuid not null references public.households(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '2 days', used_at timestamptz
);
create table public.household_records (
 household_id uuid references public.households(id) on delete cascade,
 bucket text not null check(bucket in ('stock','cart','custom','history')),
 key text not null check(length(key) between 1 and 160),
 value jsonb, revision bigint not null default 1,
 primary key(household_id,bucket,key)
);
-- Tombstones (value = null) retain revisions, preventing stale writes after deletion.
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.household_records enable row level security;

create function public.is_household_member(hid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.household_members where household_id=hid and user_id=auth.uid());
$$;
create policy household_read on public.households for select to authenticated using(public.is_household_member(id));
create policy membership_read on public.household_members for select to authenticated using(public.is_household_member(household_id));
create policy records_read on public.household_records for select to authenticated using(public.is_household_member(household_id));
-- No direct client writes: all mutations pass membership and concurrency checks in RPCs.

create function public.create_household(household_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare hid uuid; begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 insert into public.households(name,owner_id) values(trim(household_name),auth.uid()) returning id into hid;
 insert into public.household_members values(hid,auth.uid());return hid;
end $$;
create function public.invite_household(hid uuid) returns text language plpgsql security definer set search_path='' as $$
declare token text; begin
 if not exists(select 1 from public.households where id=hid and owner_id=auth.uid()) then raise exception 'Owner access required';end if;
 token=gen_random_uuid()::text||gen_random_uuid()::text;
 insert into public.household_invites(token_hash,household_id) values(sha256(convert_to(token,'UTF8')),hid);return token;
end $$;
create function public.join_household(invite_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.household_invites; begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into inv from public.household_invites where token_hash=sha256(convert_to(invite_token,'UTF8')) for update;
 if not found or inv.used_at is not null or inv.expires_at<now() then raise exception 'Invitation expired or already used';end if;
 insert into public.household_members values(inv.household_id,auth.uid()) on conflict do nothing;
 update public.household_invites set used_at=now() where token_hash=inv.token_hash;return inv.household_id;
end $$;
create function public.revoke_household_invites(hid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.households where id=hid and owner_id=auth.uid()) then raise exception 'Owner access required';end if;
 delete from public.household_invites where household_id=hid;
end $$;
create function public.remove_household_member(hid uuid, member_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.households where id=hid and owner_id=auth.uid() and owner_id<>member_id) then raise exception 'Owner access required';end if;
 delete from public.household_members where household_id=hid and user_id=member_id;
end $$;
create function public.apply_household_changes(hid uuid, changes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c jsonb; actual bigint; begin
 -- Serialize mutations in this household; checking membership after the lock prevents races.
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>3000 then raise exception 'Invalid changes';end if;
 for c in select * from jsonb_array_elements(changes) loop
  if octet_length(c::text)>100000 then raise exception 'Item too large';end if;
  if c->'value' is not null and c->'value'<>'null'::jsonb then
   if c->>'bucket'='stock' and c->'value' not in ('0'::jsonb,'2'::jsonb) then raise exception 'Invalid stock';end if;
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
revoke all on public.households,public.household_members,public.household_invites,public.household_records from anon,authenticated;
grant select on public.households,public.household_members,public.household_records to authenticated;
revoke all on function public.is_household_member(uuid),public.create_household(text),public.invite_household(uuid),public.join_household(text),public.revoke_household_invites(uuid),public.remove_household_member(uuid,uuid),public.apply_household_changes(uuid,jsonb) from public;
grant execute on function public.is_household_member(uuid),public.create_household(text),public.invite_household(uuid),public.join_household(text),public.revoke_household_invites(uuid),public.remove_household_member(uuid,uuid),public.apply_household_changes(uuid,jsonb) to authenticated;
