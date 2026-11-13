-- Additive shared context. Existing buckets, RPC arguments and revisions remain intact.
begin;
create or replace function public.apply_household_changes(hid uuid, changes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c jsonb; actual bigint; begin
 -- Serialize mutations in this household; checking membership after the lock prevents races.
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>3000 then raise exception 'Invalid changes';end if;
 for c in select * from jsonb_array_elements(changes) loop
  if octet_length(c::text)>100000 then raise exception 'Item too large';end if;
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

-- A low item is still present; legacy inventory is not backfilled as freshly checked.
create or replace function public.track_pantry_presence() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.bucket<>'stock' then return new;end if;
 if new.value in ('1'::jsonb,'2'::jsonb) then
  if TG_OP='INSERT' or old.value is distinct from new.value then
   insert into public.household_pantry_reviews(household_id,product_name,stock_revision,confirmed_by) values(new.household_id,new.key,new.revision,auth.uid())
   on conflict(household_id,product_name) do update set stock_revision=excluded.stock_revision,last_confirmed_at=now(),confirmed_by=excluded.confirmed_by;
  end if;
 else delete from public.household_pantry_reviews where household_id=new.household_id and product_name=new.key;end if;return new;
end $$;
create or replace function public.confirm_pantry_items(hid uuid,items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; actual public.household_records;begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)>1000 then raise exception 'Invalid items';end if;
 for item in select * from jsonb_array_elements(items) loop
  select * into actual from public.household_records where household_id=hid and bucket='stock' and key=item->>'name';
  if not found or actual.value is null or actual.value not in ('1'::jsonb,'2'::jsonb) or actual.revision is distinct from (item->>'revision')::bigint then raise exception 'Conflict: pantry changed' using errcode='40001';end if;
  insert into public.household_pantry_reviews(household_id,product_name,stock_revision,confirmed_by) values(hid,actual.key,actual.revision,auth.uid())
  on conflict(household_id,product_name) do update set stock_revision=excluded.stock_revision,last_confirmed_at=now(),confirmed_by=excluded.confirmed_by;
 end loop;
end $$;

create table if not exists public.household_kitchen_preferences(
 household_id uuid not null references public.households(id) on delete cascade,
 key text not null check(key in ('servings','maxMinutes','diet','avoid')),value jsonb not null,revision bigint not null default 1,
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id) on delete set null,primary key(household_id,key)
);
create table if not exists public.household_kitchen_events(
 id bigint generated always as identity primary key,household_id uuid not null references public.households(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 event_type text not null check(event_type in ('stock_home','stock_low','stock_out','list_added','list_updated','list_checked','list_unchecked','list_removed','shopping_completed','recipe_started','recipe_completed','preferences_updated')),
 subject text check(length(subject)<=160),item_count integer not null default 1 check(item_count between 0 and 3000),
 event_key text not null,unique(household_id,event_key)
);
create index if not exists kitchen_events_recent on public.household_kitchen_events(household_id,created_at desc,id desc);
alter table public.household_kitchen_preferences enable row level security;
alter table public.household_kitchen_events enable row level security;
drop policy if exists kitchen_preferences_read on public.household_kitchen_preferences;
create policy kitchen_preferences_read on public.household_kitchen_preferences for select to authenticated using(public.is_household_member(household_id));
drop policy if exists kitchen_events_read on public.household_kitchen_events;
create policy kitchen_events_read on public.household_kitchen_events for select to authenticated using(public.is_household_member(household_id));
revoke all on public.household_kitchen_preferences,public.household_kitchen_events from anon,authenticated;
grant select on public.household_kitchen_preferences,public.household_kitchen_events to authenticated;

create or replace function public.set_kitchen_preferences(hid uuid,changes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c jsonb;actual bigint;prior jsonb;n text;v jsonb;changed boolean:=false;begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>4 then raise exception 'Invalid preferences';end if;
 for c in select * from jsonb_array_elements(changes) loop
  n=c->>'key';v=c->'value';
  if n is null or n not in ('servings','maxMinutes','diet','avoid') or v is null then raise exception 'Invalid preferences';end if;
  if n='servings' and v not in ('1','2','3','4','5','6','7','8') then raise exception 'Invalid servings';end if;
  if n='maxMinutes' and v not in ('0','25','45','60') then raise exception 'Invalid time';end if;
  if n='diet' and v not in ('"any"','"vegetarian"','"vegan"') then raise exception 'Invalid diet';end if;
  if n='avoid' then
   if jsonb_typeof(v)<>'array' or jsonb_array_length(v)>10 then raise exception 'Invalid avoided ingredients';end if;
   if exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 80 or (x#>>'{}') ~ '[[:cntrl:]]') then raise exception 'Invalid avoided ingredients';end if;
  end if;
  select revision,value into actual,prior from public.household_kitchen_preferences where household_id=hid and key=n;
  if coalesce(actual,0) is distinct from (c->>'expected')::bigint then raise exception 'Conflict: preferences changed' using errcode='40001';end if;
  if prior is distinct from v then
   insert into public.household_kitchen_preferences(household_id,key,value,revision,updated_by) values(hid,n,v,coalesce(actual,0)+1,auth.uid())
   on conflict(household_id,key) do update set value=excluded.value,revision=excluded.revision,updated_at=now(),updated_by=excluded.updated_by;changed:=true;
  end if;
 end loop;
 if changed then insert into public.household_kitchen_events(household_id,actor_id,event_type,event_key) values(hid,auth.uid(),'preferences_updated','preferences:'||gen_random_uuid());end if;
end $$;

create or replace function public.track_kitchen_change() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;previous jsonb;amount integer:=1;begin
 if auth.uid() is null then return new;end if;
 if TG_OP='UPDATE' then previous:=old.value;end if;
 if previous is not distinct from new.value then return new;end if;
 if new.bucket='stock' then kind:=case when new.value='2'::jsonb then 'stock_home' when new.value='1'::jsonb then 'stock_low' else 'stock_out' end;
 elsif new.bucket='cart' then
  kind:=case when new.value is null then 'list_removed' when previous is null then 'list_added' when new.value->'done'='true'::jsonb and coalesce(previous->'done','false'::jsonb)<>'true'::jsonb then 'list_checked' when previous->'done'='true'::jsonb and coalesce(new.value->'done','false'::jsonb)<>'true'::jsonb then 'list_unchecked' else 'list_updated' end;
 elsif new.bucket='history' and previous is null and new.value is not null then
  kind:='shopping_completed';amount:=jsonb_array_length(new.value->'items');
 else return new;end if;
 insert into public.household_kitchen_events(household_id,actor_id,event_type,subject,item_count,event_key) values(new.household_id,auth.uid(),kind,case when new.bucket='history' then null else new.key end,least(3000,amount),'record:'||new.bucket||':'||md5(new.key)||':'||new.revision) on conflict do nothing;return new;
end $$;
drop trigger if exists track_kitchen_change on public.household_records;
create trigger track_kitchen_change after insert or update on public.household_records for each row execute function public.track_kitchen_change();

create or replace function public.record_kitchen_recipe(hid uuid,kind text,title text,client_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if kind is null or kind not in ('recipe_started','recipe_completed') or title is null or length(trim(title)) not between 1 and 120 or client_id is null or length(client_id) not between 1 and 100 or title ~ '[[:cntrl:]]' then raise exception 'Invalid recipe event';end if;
 insert into public.household_kitchen_events(household_id,actor_id,event_type,subject,event_key) values(hid,auth.uid(),kind,trim(title),'recipe:'||auth.uid()||':'||kind||':'||client_id) on conflict do nothing;
end $$;
revoke all on function public.track_kitchen_change(),public.set_kitchen_preferences(uuid,jsonb),public.record_kitchen_recipe(uuid,text,text,text) from public;
grant execute on function public.set_kitchen_preferences(uuid,jsonb),public.record_kitchen_recipe(uuid,text,text,text) to authenticated;
do $$ declare n text;begin
 foreach n in array array['household_kitchen_preferences','household_kitchen_events'] loop
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=n) then execute format('alter publication supabase_realtime add table public.%I',n);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
