-- Plus pilot grants and bounded, atomic spend reservations. Existing Free RPCs stay intact.
-- Only service_role may provision access or spend; clients cannot choose their entitlement.
create table if not exists public.morzsa_plus_entitlements (
 scope text primary key check (scope ~ '^(user|home):[0-9a-f-]{36}$' or scope='global'),
 enabled boolean not null default true, expires_at timestamptz,
 monthly_cents integer not null default 1000 check (monthly_cents between 0 and 100000),
 chat_limit integer not null default 500, image_limit integer not null default 60, voice_limit integer not null default 30
);
create table if not exists public.morzsa_plus_requests (
 request_id uuid primary key, user_id uuid not null, scope text not null,
 kind text not null check (kind in ('chat','image','voice')), created_at timestamptz not null default now(),
 reserved_cents integer not null check (reserved_cents between 1 and 100),
 charged_cents integer, state text not null default 'reserved' check(state in ('reserved','complete','failed')),
 model text, usage jsonb, call_id text, expires_at timestamptz
);
create index if not exists morzsa_plus_scope_month on public.morzsa_plus_requests(scope,created_at);
alter table public.morzsa_plus_entitlements enable row level security;
alter table public.morzsa_plus_requests enable row level security;
revoke all on public.morzsa_plus_entitlements,public.morzsa_plus_requests from public,anon,authenticated;
grant select,insert,update,delete on public.morzsa_plus_entitlements,public.morzsa_plus_requests to service_role;
insert into public.morzsa_plus_entitlements(scope,monthly_cents,chat_limit,image_limit,voice_limit)
 values ('global',10000,5000,500,300) on conflict do nothing;
create or replace function public.morzsa_plus_access(user_id uuid,hid uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare grant_row public.morzsa_plus_entitlements; spent integer;
begin
 if user_id is null then return jsonb_build_object('enabled',false); end if;
 if hid is not null and not exists(select 1 from public.household_members m where m.household_id=hid and m.user_id=morzsa_plus_access.user_id) then
  return jsonb_build_object('enabled',false);
 end if;
 select * into grant_row from public.morzsa_plus_entitlements e
 where e.enabled and (e.expires_at is null or e.expires_at>now())
 and (e.scope='user:'||user_id::text or (hid is not null and e.scope='home:'||hid::text))
 order by (e.scope='home:'||hid::text) desc nulls last limit 1;
 if not found then return jsonb_build_object('enabled',false); end if;
 select coalesce(sum(coalesce(charged_cents,reserved_cents)),0)::integer into spent
 from public.morzsa_plus_requests r where r.scope=grant_row.scope and r.created_at>=date_trunc('month',now());
 return jsonb_build_object('enabled',true,'scope',grant_row.scope,'remainingCents',greatest(0,grant_row.monthly_cents-spent));
end $$;
create or replace function public.reserve_morzsa_plus(user_id uuid,hid uuid,request_id uuid,kind text,reserve_cents integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare access jsonb; local_grant public.morzsa_plus_entitlements; global_grant public.morzsa_plus_entitlements; n integer; cost integer; limit_n integer;
begin
 if kind not in ('chat','image','voice') or reserve_cents not between 1 and 100 or request_id is null then return jsonb_build_object('status','invalid'); end if;
 -- Lock global before household/user to serialize requests, including cross-member calls.
 select * into global_grant from public.morzsa_plus_entitlements where scope='global' for update;
 if not found or not global_grant.enabled then return jsonb_build_object('status','disabled'); end if;
 access=public.morzsa_plus_access(user_id,hid);
 if not (access->>'enabled')::boolean then return jsonb_build_object('status','denied'); end if;
 select * into local_grant from public.morzsa_plus_entitlements where scope=access->>'scope' for update;
 if exists(select 1 from public.morzsa_plus_requests r where r.request_id=reserve_morzsa_plus.request_id) then return jsonb_build_object('status','duplicate'); end if;
 for n in 1..2 loop
  if n=1 then limit_n=case kind when 'chat' then global_grant.chat_limit when 'image' then global_grant.image_limit else global_grant.voice_limit end;
  else limit_n=case kind when 'chat' then local_grant.chat_limit when 'image' then local_grant.image_limit else local_grant.voice_limit end; end if;
  select coalesce(sum(coalesce(r.charged_cents,r.reserved_cents)),0)::integer into cost from public.morzsa_plus_requests r
   where r.created_at>=date_trunc('month',now()) and (n=1 or r.scope=local_grant.scope);
  if cost+reserve_cents>(case n when 1 then global_grant.monthly_cents else local_grant.monthly_cents end)
   or (select count(*) from public.morzsa_plus_requests r where r.created_at>=date_trunc('month',now()) and r.kind=reserve_morzsa_plus.kind and (n=1 or r.scope=local_grant.scope))>=limit_n
   then return jsonb_build_object('status','limit'); end if;
 end loop;
 if kind='voice' and exists(select 1 from public.morzsa_plus_requests r where r.user_id=reserve_morzsa_plus.user_id and r.kind='voice' and r.state='reserved' and r.created_at>now()-interval '3 minutes') then return jsonb_build_object('status','pending'); end if;
 insert into public.morzsa_plus_requests(request_id,user_id,scope,kind,reserved_cents) values(request_id,user_id,local_grant.scope,kind,reserve_cents);
 return jsonb_build_object('status','reserved','remainingCents',(access->>'remainingCents')::integer-reserve_cents);
end $$;
revoke all on function public.morzsa_plus_access(uuid,uuid),public.reserve_morzsa_plus(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.morzsa_plus_access(uuid,uuid),public.reserve_morzsa_plus(uuid,uuid,uuid,text,integer) to service_role;
