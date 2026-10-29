-- Additive, service-only cache and quota. Existing household records are unchanged.
create table if not exists public.recipe_idea_cache (
 owner_id uuid not null, cache_key text not null, payload jsonb not null,
 expires_at timestamptz not null, primary key(owner_id,cache_key)
);
create index if not exists recipe_idea_cache_expiry on public.recipe_idea_cache(expires_at);
create table if not exists public.recipe_idea_usage (
 day date not null, scope text not null, calls integer not null default 0,
 primary key(day,scope)
);
alter table public.recipe_idea_cache enable row level security;
alter table public.recipe_idea_usage enable row level security;
revoke all on public.recipe_idea_cache, public.recipe_idea_usage from public, anon, authenticated;
grant select,insert,update,delete on public.recipe_idea_cache to service_role;
create or replace function public.claim_recipe_idea_request(user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare day_key date := (now() at time zone 'UTC')::date; total integer; personal integer;
begin
 if user_id is null then return false; end if;
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
revoke all on function public.claim_recipe_idea_request(uuid) from public,anon,authenticated;
grant execute on function public.claim_recipe_idea_request(uuid) to service_role;
