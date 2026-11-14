-- Additive shopping sessions and store routes. Cart/stock/history retain their old formats.
create table if not exists public.household_shopping_sessions(
 id uuid primary key,household_id uuid not null references public.households(id) on delete cascade,
 started_by uuid references auth.users(id) on delete set null,started_at timestamptz not null default now(),
 finished_at timestamptz,finished_by uuid references auth.users(id) on delete set null
);
create unique index if not exists one_active_shopping_session on public.household_shopping_sessions(household_id) where finished_at is null;
create table if not exists public.household_shopping_routes(
 household_id uuid primary key references public.households(id) on delete cascade,
 categories jsonb not null default '[]',revision bigint not null default 1,updated_by uuid references auth.users(id) on delete set null
);
alter table public.household_shopping_sessions enable row level security;
alter table public.household_shopping_routes enable row level security;
drop policy if exists shopping_session_read on public.household_shopping_sessions;
create policy shopping_session_read on public.household_shopping_sessions for select to authenticated using(public.is_household_member(household_id));
drop policy if exists shopping_route_read on public.household_shopping_routes;
create policy shopping_route_read on public.household_shopping_routes for select to authenticated using(public.is_household_member(household_id));
revoke all on public.household_shopping_sessions,public.household_shopping_routes from anon,authenticated;
grant select on public.household_shopping_sessions,public.household_shopping_routes to authenticated;

create or replace function public.start_shopping_session(hid uuid,sid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.household_shopping_sessions;begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 select * into s from public.household_shopping_sessions where household_id=hid and finished_at is null;
 if s.id is not null then return to_jsonb(s);end if;
 if sid is null or exists(select 1 from public.household_shopping_sessions where id=sid) then raise exception 'Invalid session';end if;
 insert into public.household_shopping_sessions(id,household_id,started_by) values(sid,hid,auth.uid()) returning * into s;
 return to_jsonb(s);
end $$;
create or replace function public.set_shopping_route(hid uuid,categories jsonb,expected bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actual bigint;result public.household_shopping_routes;begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if jsonb_typeof(categories) is distinct from 'array' or jsonb_array_length(categories)>50 then raise exception 'Invalid route';end if;
 if exists(select 1 from jsonb_array_elements(categories) x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 80 or (x#>>'{}') ~ '[[:cntrl:]]') or (select count(*) from jsonb_array_elements(categories))<>(select count(distinct x) from jsonb_array_elements(categories) x) then raise exception 'Invalid route';end if;
 select revision into actual from public.household_shopping_routes where household_id=hid;
 if coalesce(actual,0) is distinct from expected then raise exception 'Conflict: route changed' using errcode='40001';end if;
 insert into public.household_shopping_routes(household_id,categories,revision,updated_by) values(hid,categories,coalesce(actual,0)+1,auth.uid()) on conflict(household_id) do update set categories=excluded.categories,revision=excluded.revision,updated_by=excluded.updated_by returning * into result;
 return to_jsonb(result);
end $$;
create or replace function public.finish_shopping_session(hid uuid,sid uuid,purchased jsonb,allow_unchecked boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.household_shopping_sessions;c jsonb;r public.household_records;stock_revision bigint;items jsonb:='[]';changes jsonb:='[]';archive jsonb;history_revision bigint;begin
 -- Uses the same household lock as apply_household_changes, including older clients.
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 select * into s from public.household_shopping_sessions where id=sid and household_id=hid;
 if s.id is null then raise exception 'Invalid session';end if;
 if s.finished_at is not null then select value into archive from public.household_records where household_id=hid and bucket='history' and key=sid::text;return archive;end if;
 if jsonb_typeof(purchased) is distinct from 'array' or jsonb_array_length(purchased)>1000 or (select count(*) from jsonb_array_elements(purchased))<>(select count(distinct x->>'name') from jsonb_array_elements(purchased) x) then raise exception 'Invalid purchases';end if;
 for c in select * from jsonb_array_elements(purchased) loop
  if coalesce(length(c->>'name'),0) not between 1 and 80 or coalesce(length(c->>'category'),0) not between 1 and 80 then raise exception 'Invalid purchase';end if;
  select * into r from public.household_records where household_id=hid and bucket='cart' and key=c->>'name';
  if r.value is null or r.revision is distinct from (c->>'expected')::bigint then raise exception 'Conflict: shopping list changed' using errcode='40001';end if;
  if r.value->'done' is distinct from 'true'::jsonb and (not coalesce(allow_unchecked,false) or exists(select 1 from public.household_records where household_id=hid and bucket='custom' and key=r.key and value is not null)) then raise exception 'Item is not purchased';end if;
  items:=items||jsonb_build_array(r.value||jsonb_build_object('done',true,'category',c->>'category','purchasedBy',coalesce(r.value->>'purchasedBy',auth.uid()::text),'purchasedAt',coalesce(r.value->>'purchasedAt',now()::text)));
  changes:=changes||jsonb_build_array(jsonb_build_object('bucket','cart','key',r.key,'value',null,'expected',r.revision));
  select revision into stock_revision from public.household_records where household_id=hid and bucket='stock' and key=r.key;
  changes:=changes||jsonb_build_array(jsonb_build_object('bucket','stock','key',r.key,'value',2,'expected',coalesce(stock_revision,0)));
 end loop;
 if jsonb_array_length(items)>0 then
  archive:=jsonb_build_object('id',sid::text,'date',now(),'kind','purchase','items',items,'shoppingSession',sid::text);
  select revision into history_revision from public.household_records where household_id=hid and bucket='history' and key=sid::text;
  changes:=changes||jsonb_build_array(jsonb_build_object('bucket','history','key',sid::text,'value',archive,'expected',coalesce(history_revision,0)));
  perform public.apply_household_changes(hid,changes);
 end if;
 update public.household_shopping_sessions set finished_at=now(),finished_by=auth.uid() where id=sid;
 return archive;
end $$;
revoke all on function public.start_shopping_session(uuid,uuid),public.set_shopping_route(uuid,jsonb,bigint),public.finish_shopping_session(uuid,uuid,jsonb,boolean) from public,anon;
grant execute on function public.start_shopping_session(uuid,uuid),public.set_shopping_route(uuid,jsonb,bigint),public.finish_shopping_session(uuid,uuid,jsonb,boolean) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='household_shopping_sessions') then alter publication supabase_realtime add table public.household_shopping_sessions;end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='household_shopping_routes') then alter publication supabase_realtime add table public.household_shopping_routes;end if;
 end if;
end $$;

-- Attribute list edits on the server, including actions from older clients.
create or replace function public.attribute_shopping_item() returns trigger language plpgsql security definer set search_path='' as $$
declare prior jsonb;sid text;begin
 if new.bucket<>'cart' or new.value is null or auth.uid() is null then return new;end if;
 if TG_OP='UPDATE' then prior:=old.value;end if;
 if prior is null then new.value:=new.value||jsonb_build_object('addedBy',auth.uid()::text,'addedAt',now());
 else new.value:=new.value||jsonb_build_object('addedBy',prior->'addedBy','addedAt',prior->'addedAt');end if;
 if new.value->'done'='true'::jsonb then
  if prior->'done' is distinct from 'true'::jsonb then new.value:=new.value||jsonb_build_object('purchasedBy',auth.uid()::text,'purchasedAt',now());
  else new.value:=new.value||jsonb_build_object('purchasedBy',prior->'purchasedBy','purchasedAt',prior->'purchasedAt');end if;
 else new.value:=new.value-'purchasedBy'-'purchasedAt';end if;
 sid:=new.value->>'shoppingSession';
 if sid is not null and not exists(select 1 from public.household_shopping_sessions where id::text=sid and household_id=new.household_id and finished_at is null) then new.value:=new.value-'shoppingSession';end if;
 return new;
end $$;
drop trigger if exists shopping_item_attribution on public.household_records;
create trigger shopping_item_attribution before insert or update on public.household_records for each row execute function public.attribute_shopping_item();
