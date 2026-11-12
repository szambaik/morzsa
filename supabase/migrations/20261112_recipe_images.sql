-- Additive, service-only jobs. No pantry/history data is migrated.
create table if not exists public.recipe_image_jobs (
 owner_id uuid not null, cache_key text not null, state text not null,
 lease uuid, asset_path text, updated_at timestamptz not null default now(),
 primary key(owner_id,cache_key), check(state in ('pending','ready','failed'))
);
create table if not exists public.recipe_image_usage (
 day date not null, scope text not null, calls integer not null default 0,
 primary key(day,scope)
);
alter table public.recipe_image_jobs enable row level security;
alter table public.recipe_image_usage enable row level security;
revoke all on public.recipe_image_jobs,public.recipe_image_usage from public,anon,authenticated;
grant select,insert,update on public.recipe_image_jobs to service_role;
create or replace function public.claim_recipe_image(user_id uuid, image_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d date := (now() at time zone 'UTC')::date; job public.recipe_image_jobs; total int; personal int; token uuid;
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
 if total>=50 or personal>=20 then return jsonb_build_object('status','limit'); end if;
 token:=gen_random_uuid();
 update public.recipe_image_usage set calls=calls+1 where day=d and scope in ('global',user_id::text);
 insert into public.recipe_image_jobs(owner_id,cache_key,state,lease) values(user_id,image_key,'pending',token)
 on conflict(owner_id,cache_key) do update set state='pending',lease=token,asset_path=null,updated_at=now();
 delete from public.recipe_image_usage where day<d-7;
 return jsonb_build_object('status','claimed','lease',token);
end;
$$;
revoke all on function public.claim_recipe_image(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_recipe_image(uuid,text) to service_role;
-- Private objects are accessible only through short-lived signed URLs.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('recipe-images','recipe-images',false,5242880,array['image/png','image/jpeg'])
  on conflict(id) do nothing;
  if exists(select 1 from storage.buckets where id='recipe-images' and public=true) then
   raise exception 'recipe-images bucket must be private';
  end if;
 end if;
end $$;
