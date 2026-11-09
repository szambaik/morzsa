-- Separate table: older clients must not see an unfamiliar household_records bucket.
create table if not exists public.household_pantry_reviews(
 household_id uuid not null references public.households(id) on delete cascade,
 product_name text not null check(length(product_name) between 1 and 160),
 stock_revision bigint not null,
 last_confirmed_at timestamptz not null default now(),
 confirmed_by uuid references auth.users(id) on delete set null,
 primary key(household_id,product_name)
);
alter table public.household_pantry_reviews enable row level security;
drop policy if exists pantry_reviews_read on public.household_pantry_reviews;
create policy pantry_reviews_read on public.household_pantry_reviews for select to authenticated using(public.is_household_member(household_id));
revoke all on public.household_pantry_reviews from anon,authenticated;
grant select on public.household_pantry_reviews to authenticated;
create or replace function public.track_pantry_presence() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.bucket<>'stock' then return new;end if;
 if new.value='2'::jsonb then
  if TG_OP='INSERT' or old.value is distinct from new.value then
   insert into public.household_pantry_reviews(household_id,product_name,stock_revision,confirmed_by)
   values(new.household_id,new.key,new.revision,auth.uid())
   on conflict(household_id,product_name) do update set stock_revision=excluded.stock_revision,last_confirmed_at=now(),confirmed_by=excluded.confirmed_by;
  end if;
 else delete from public.household_pantry_reviews where household_id=new.household_id and product_name=new.key;
 end if;return new;
end $$;
drop trigger if exists track_pantry_presence on public.household_records;
create trigger track_pantry_presence after insert or update on public.household_records for each row execute function public.track_pantry_presence();
create or replace function public.confirm_pantry_items(hid uuid,items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; actual public.household_records;begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)>1000 then raise exception 'Invalid items';end if;
 for item in select * from jsonb_array_elements(items) loop
  select * into actual from public.household_records where household_id=hid and bucket='stock' and key=item->>'name';
  if not found or actual.value is distinct from '2'::jsonb or actual.revision is distinct from (item->>'revision')::bigint then raise exception 'Conflict: pantry changed' using errcode='40001';end if;
  insert into public.household_pantry_reviews(household_id,product_name,stock_revision,confirmed_by) values(hid,actual.key,actual.revision,auth.uid())
  on conflict(household_id,product_name) do update set stock_revision=excluded.stock_revision,last_confirmed_at=now(),confirmed_by=excluded.confirmed_by;
 end loop;
end $$;
revoke all on function public.track_pantry_presence() from public;
revoke all on function public.confirm_pantry_items(uuid,jsonb) from public;
grant execute on function public.confirm_pantry_items(uuid,jsonb) to authenticated;
-- Existing inventory is deliberately not backfilled with today's timestamp.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='household_pantry_reviews') then
  alter publication supabase_realtime add table public.household_pantry_reviews;
 end if;
end $$;
