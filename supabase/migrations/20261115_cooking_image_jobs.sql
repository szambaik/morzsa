-- Queue handles allow recovery without submitting/billing another generation.
alter table public.recipe_asset_jobs add column if not exists provider_request jsonb;
alter table public.recipe_asset_jobs add column if not exists previous_asset jsonb;
-- Explicit refresh is owner-only; old files remain in Storage and recoverable.
create or replace function public.request_recipe_image_refresh(rid uuid,image_step int,user_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare job public.recipe_asset_jobs;begin
 if user_id is null or not exists(select 1 from public.recipe_documents where id=rid and owner_id=user_id and not published) then raise exception 'Image refresh access denied';end if;
 perform 1 from public.recipe_documents where id=rid for update;
 select * into job from public.recipe_asset_jobs where recipe_id=rid and step=image_step for update;
 if job.state is distinct from 'ready' then return false;end if;
 update public.recipe_asset_jobs set previous_asset=jsonb_build_object('asset_path',asset_path,'bucket',bucket,'model',model,'thumbnail_path',thumbnail_path),state='failed',asset_path=null,thumbnail_path=null,provider_request=null,updated_at=now()-interval '2 minutes' where recipe_id=rid and step=image_step;
 return true;
end $$;
revoke all on function public.request_recipe_image_refresh(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.request_recipe_image_refresh(uuid,integer,uuid) to service_role;

-- A new lease must never inherit the terminal handle of a previous attempt.
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
 insert into public.recipe_asset_jobs(recipe_id,step,state,lease,model) values(rid,image_step,'pending',token,image_model) on conflict(recipe_id,step) do update set state='pending',lease=token,model=image_model,provider_request=null,updated_at=now();
 return jsonb_build_object('status','claimed','lease',token);
end $$;
notify pgrst,'reload schema';
