-- One server-owned switch for Morzsa's own counters (not provider billing).
-- Safe default: enabled. Test mode is an explicit admin UPDATE after deployment.
create table if not exists public.morzsa_runtime_settings (
 singleton boolean primary key default true check(singleton),
 usage_limits_enabled boolean not null default true
);
insert into public.morzsa_runtime_settings(singleton) values(true) on conflict do nothing;
alter table public.morzsa_runtime_settings enable row level security;
revoke all on public.morzsa_runtime_settings from public,anon,authenticated;
grant select,update on public.morzsa_runtime_settings to service_role;
create or replace function public.morzsa_usage_limits_enabled() returns boolean
language sql security definer set search_path='' as $$
 select usage_limits_enabled from public.morzsa_runtime_settings where singleton for share;
$$;
revoke all on function public.morzsa_usage_limits_enabled() from public,anon,authenticated;
grant execute on function public.morzsa_usage_limits_enabled() to service_role;
-- Keep operational IDs/leases for retries and voice cleanup. Test-mode requests
-- never enter allowance totals, even after counters are switched back on.
alter table public.morzsa_plus_requests add column if not exists usage_counted boolean not null default true;

-- Release failed, uncharged reservations without changing any entitlement or spend cap.
-- Known provider charges remain counted, including a failed request with measured usage.
create or replace function public.morzsa_plus_access(user_id uuid,hid uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare grant_row public.morzsa_plus_entitlements; spent integer; counting boolean := public.morzsa_usage_limits_enabled();
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
 select coalesce(sum(case when state='failed' then coalesce(charged_cents,0) else coalesce(charged_cents,reserved_cents) end),0)::integer into spent
 from public.morzsa_plus_requests r where r.usage_counted and r.scope=grant_row.scope and r.created_at>=date_trunc('month',now());
 return jsonb_build_object('enabled',true,'scope',grant_row.scope,'usageLimitsEnabled',counting,'remainingCents',case when counting then greatest(0,grant_row.monthly_cents-spent) else null end,'monthlyCents',grant_row.monthly_cents,'resetsAt',date_trunc('month',now())+interval '1 month');
end $$;
create or replace function public.reserve_morzsa_plus(user_id uuid,hid uuid,request_id uuid,kind text,reserve_cents integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare access jsonb; local_grant public.morzsa_plus_entitlements; global_grant public.morzsa_plus_entitlements; n integer; cost integer; limit_n integer; counting boolean := public.morzsa_usage_limits_enabled();
begin
 if kind not in ('chat','image','voice') or reserve_cents not between 1 and 100 or request_id is null then return jsonb_build_object('status','invalid'); end if;
 -- Lock global before household/user to serialize requests, including cross-member calls.
 select * into global_grant from public.morzsa_plus_entitlements where scope='global' for update;
 if not found or not global_grant.enabled then return jsonb_build_object('status','disabled'); end if;
 access=public.morzsa_plus_access(user_id,hid);
 if not (access->>'enabled')::boolean then return jsonb_build_object('status','denied'); end if;
 select * into local_grant from public.morzsa_plus_entitlements where scope=access->>'scope' for update;
 if exists(select 1 from public.morzsa_plus_requests r where r.request_id=reserve_morzsa_plus.request_id) then return jsonb_build_object('status','duplicate'); end if;
 if counting then
 for n in 1..2 loop
  if n=1 then limit_n=case kind when 'chat' then global_grant.chat_limit when 'image' then global_grant.image_limit else global_grant.voice_limit end;
  else limit_n=case kind when 'chat' then local_grant.chat_limit when 'image' then local_grant.image_limit else local_grant.voice_limit end; end if;
  select coalesce(sum(case when r.state='failed' then coalesce(r.charged_cents,0) else coalesce(r.charged_cents,r.reserved_cents) end),0)::integer into cost from public.morzsa_plus_requests r
   where r.usage_counted and r.created_at>=date_trunc('month',now()) and (n=1 or r.scope=local_grant.scope);
  if cost+reserve_cents>(case n when 1 then global_grant.monthly_cents else local_grant.monthly_cents end) then
   return jsonb_build_object('status','limit','reason','budget','scopeType',case n when 1 then 'global' else 'personal' end,'remainingCents',greatest(0,(case n when 1 then global_grant.monthly_cents else local_grant.monthly_cents end)-cost),'resetsAt',date_trunc('month',now())+interval '1 month');
  end if;
  if (select count(*) from public.morzsa_plus_requests r where r.usage_counted and r.created_at>=date_trunc('month',now()) and r.kind=reserve_morzsa_plus.kind and (n=1 or r.scope=local_grant.scope))>=limit_n then
   return jsonb_build_object('status','limit','reason','requests','kind',kind,'scopeType',case n when 1 then 'global' else 'personal' end,'resetsAt',date_trunc('month',now())+interval '1 month');
  end if;
 end loop;
 end if;
 if kind='voice' and exists(select 1 from public.morzsa_plus_requests r where r.user_id=reserve_morzsa_plus.user_id and r.kind='voice' and r.state='reserved' and r.created_at>now()-interval '3 minutes') then return jsonb_build_object('status','pending'); end if;
 insert into public.morzsa_plus_requests(request_id,user_id,scope,kind,reserved_cents,usage_counted) values(request_id,user_id,local_grant.scope,kind,reserve_cents,counting);
 return jsonb_build_object('status','reserved','usageLimitsEnabled',counting,'remainingCents',case when counting then (access->>'remainingCents')::integer-reserve_cents else null end);
end $$;
revoke all on function public.morzsa_plus_access(uuid,uuid),public.reserve_morzsa_plus(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.morzsa_plus_access(uuid,uuid),public.reserve_morzsa_plus(uuid,uuid,uuid,text,integer) to service_role;


create or replace function public.claim_recipe_idea_request(user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare day_key date := (now() at time zone 'UTC')::date; total integer; personal integer;
begin
 if user_id is null then return false; end if;
 if not public.morzsa_usage_limits_enabled() then return true; end if;
 insert into public.recipe_idea_usage(day,scope) values(day_key,'global') on conflict do nothing;
 select calls into total from public.recipe_idea_usage where day=day_key and scope='global' for update;
 insert into public.recipe_idea_usage(day,scope) values(day_key,user_id::text) on conflict do nothing;
 select calls into personal from public.recipe_idea_usage where day=day_key and scope=user_id::text;
 if total>=100 or personal>=10 then return false; end if;
 update public.recipe_idea_usage set calls=calls+1 where day=day_key and scope in ('global',user_id::text);
 delete from public.recipe_idea_cache where expires_at<now();
 delete from public.recipe_idea_usage where day<day_key-7;
 return true;
end;
$$;

create or replace function public.claim_voice_command(user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare day_key date := (now() at time zone 'UTC')::date; total integer; personal integer;
begin
 if user_id is null then return false; end if;
 if not public.morzsa_usage_limits_enabled() then return true; end if;
 insert into public.voice_command_usage(day,scope) values(day_key,'global') on conflict do nothing;
 select calls into total from public.voice_command_usage where day=day_key and scope='global' for update;
 insert into public.voice_command_usage(day,scope) values(day_key,user_id::text) on conflict do nothing;
 select calls into personal from public.voice_command_usage where day=day_key and scope=user_id::text;
 if total>=300 or personal>=30 then return false; end if;
 update public.voice_command_usage set calls=calls+1 where day=day_key and scope in ('global',user_id::text);
 delete from public.voice_command_usage where day<day_key-7;
 return true;
end;
$$;

create or replace function public.claim_recipe_image(user_id uuid, image_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d date := (now() at time zone 'UTC')::date; job public.recipe_image_jobs; total int; personal int; token uuid; counting boolean := public.morzsa_usage_limits_enabled();
begin
 if user_id is null or image_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid image request'; end if;
 insert into public.recipe_image_usage(day,scope) values(d,'global') on conflict do nothing;
 select calls into total from public.recipe_image_usage where day=d and scope='global' for update;
 select * into job from public.recipe_image_jobs where owner_id=user_id and cache_key=image_key;
 if job.state='ready' then return jsonb_build_object('status','ready'); end if;
 if job.state='pending' and job.updated_at>now()-interval '2 minutes' then return jsonb_build_object('status','pending'); end if;
 if job.state='failed' and job.updated_at>now()-interval '1 minute' then return jsonb_build_object('status','cooldown'); end if;
 insert into public.recipe_image_usage(day,scope) values(d,user_id::text) on conflict do nothing;
 select calls into personal from public.recipe_image_usage where day=d and scope=user_id::text;
 if counting and (total>=50 or personal>=20) then return jsonb_build_object('status','limit'); end if;
 token:=gen_random_uuid();
 if counting then update public.recipe_image_usage set calls=calls+1 where day=d and scope in ('global',user_id::text); end if;
 insert into public.recipe_image_jobs(owner_id,cache_key,state,lease) values(user_id,image_key,'pending',token)
 on conflict(owner_id,cache_key) do update set state='pending',lease=token,asset_path=null,updated_at=now();
 delete from public.recipe_image_usage where day<d-7;
 return jsonb_build_object('status','claimed','lease',token);
end;
$$;

-- Older deployments may not yet have the recoverable provider job handle.
alter table public.recipe_asset_jobs add column if not exists provider_request jsonb;
create or replace function public.claim_recipe_asset(rid uuid, image_step int, user_id uuid, image_model text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.recipe_asset_jobs; d date:=(now() at time zone 'UTC')::date; total int; personal int; token uuid; counting boolean := public.morzsa_usage_limits_enabled(); begin
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
 if counting and (total>=50 or personal>=20) then return jsonb_build_object('status','limit');end if;
 token:=gen_random_uuid();if counting then update public.recipe_asset_usage set calls=calls+1 where day=d and scope in ('global',user_id::text); end if;
 insert into public.recipe_asset_jobs(recipe_id,step,state,lease,model) values(rid,image_step,'pending',token,image_model) on conflict(recipe_id,step) do update set state='pending',lease=token,model=image_model,provider_request=null,updated_at=now();
 return jsonb_build_object('status','claimed','lease',token);
end $$;
notify pgrst,'reload schema';
