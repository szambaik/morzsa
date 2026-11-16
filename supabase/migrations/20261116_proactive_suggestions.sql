-- Additive: household suggestions and feedback, without changing existing RPCs.
-- Requires 20261109_pantry_reviews and 20261113_kitchen_intelligence.
begin;
create table if not exists public.household_proactive_feedback (
 household_id uuid not null references public.households(id) on delete cascade,
 key text not null check(length(key) between 1 and 220),
 action text not null check(action in ('accepted','dismissed','later','still_here')),
 fingerprint text not null, at timestamptz not null default now(), until_at timestamptz not null,
 corrections integer not null default 0, counts jsonb not null default '{}',
 primary key(household_id,key)
);
create table if not exists public.household_proactive_queue (
 household_id uuid not null references public.households(id) on delete cascade,
 key text not null, name text not null, kind text not null, fingerprint text not null, evidence jsonb not null,
 status text not null default 'ranked', expires_at timestamptz not null,
 primary key(household_id,key)
);
alter table public.household_proactive_feedback enable row level security;
alter table public.household_proactive_queue enable row level security;
drop policy if exists proactive_feedback_read on public.household_proactive_feedback;
create policy proactive_feedback_read on public.household_proactive_feedback for select to authenticated using(public.is_household_member(household_id));
drop policy if exists proactive_queue_read on public.household_proactive_queue;
create policy proactive_queue_read on public.household_proactive_queue for select to authenticated using(public.is_household_member(household_id));
revoke all on public.household_proactive_feedback,public.household_proactive_queue from anon,authenticated;
grant select on public.household_proactive_feedback,public.household_proactive_queue to authenticated;

-- Old clients could save an invalid archive date. Ignore that observation.
create or replace function public.proactive_date(value text) returns timestamptz language plpgsql stable set search_path='' as $$
begin return value::timestamptz;exception when others then return null;end $$;

create or replace function public.proactive_candidates(hid uuid)
returns table(name text,kind text,fingerprint text,evidence jsonb)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 return query
 with observations as (
  select i->>'name' n,max(public.proactive_date(h.value->>'date')) at
  from public.household_records h cross join lateral jsonb_array_elements(case when jsonb_typeof(h.value->'items')='array' then h.value->'items' else '[]'::jsonb end) i
  where h.household_id=hid and h.bucket='history' and coalesce(h.value->>'kind','purchase')='purchase'
   and length(i->>'name') between 1 and 160 and public.proactive_date(h.value->>'date') between now()-interval '180 days' and now()
  group by i->>'name',date_trunc('day',public.proactive_date(h.value->>'date') at time zone 'UTC')
 ), gaps as (
  select n,at,extract(epoch from at-lag(at) over(partition by n order by at))/86400 gap from observations
 ), rhythms as (
  select n,count(*) samples,max(at) last_at,percentile_cont(.5) within group(order by gap) days,max(gap)-min(gap) spread
  from gaps group by n having count(*)>=3
 ), candidates as (
  select s.key n,case when s.value='0'::jsonb then 'out' else 'low' end k,s.revision::text fp,
   jsonb_build_object('source','pantry','confidence','confirmed','score',case when s.value='0'::jsonb then 100 else 90 end) e
  from public.household_records s where s.household_id=hid and s.bucket='stock' and s.value in ('0'::jsonb,'1'::jsonb)
  union all
  select r.n,'recurring',coalesce(s.revision,0)::text||':'||r.last_at::text,
   jsonb_build_object('source','purchases','confidence',case when r.samples>=5 and r.spread<=r.days/2 then 'medium' else 'low' end,'score',65,
    'samples',r.samples,'days',adjusted.days,'remaining',greatest(0,ceil(extract(epoch from (r.last_at+adjusted.days*interval '1 day'-now()))/86400)))
  from rhythms r left join public.household_records s on s.household_id=hid and s.bucket='stock' and s.key=r.n
   left join public.household_pantry_reviews pr on pr.household_id=hid and pr.product_name=r.n
   left join public.household_proactive_feedback f on f.household_id=hid and f.key='product:'||lower(trim(r.n))
   cross join lateral (select r.days*(1+least(coalesce(f.corrections,0),3)*.25) days) adjusted
  where r.days between 2 and 60 and r.spread<=r.days and (s.value is null or s.value='2'::jsonb)
   and now() between r.last_at+(adjusted.days-2)*interval '1 day' and r.last_at+adjusted.days*interval '2 days'
   and (pr.last_confirmed_at is null or pr.last_confirmed_at<=r.last_at or pr.last_confirmed_at<=now()-interval '2 days')
   and (f.action is distinct from 'still_here' or now()>=f.at+adjusted.days*interval '1 day')
 )
 select c.n,c.k,c.fp,c.e from candidates c where not exists(
  select 1 from public.household_records cart where cart.household_id=hid and cart.bucket='cart' and cart.value is not null and lower(trim(cart.key))=lower(trim(c.n))
 );
end $$;

create or replace function public.read_proactive_suggestions(hid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare suggestions jsonb;feedback jsonb;begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 update public.household_proactive_queue set status='expired',expires_at=now() where household_id=hid and status in ('ranked','displayed');
 insert into public.household_proactive_queue(household_id,key,name,kind,fingerprint,evidence,expires_at)
 select hid,'product:'||lower(trim(c.name)),c.name,c.kind,c.fingerprint,c.evidence,now()+interval '1 day' from public.proactive_candidates(hid) c
 on conflict(household_id,key) do update set name=excluded.name,kind=excluded.kind,fingerprint=excluded.fingerprint,evidence=excluded.evidence,status='ranked',expires_at=excluded.expires_at;
 update public.household_proactive_queue q set status=f.action from public.household_proactive_feedback f
 where q.household_id=hid and f.household_id=hid and q.key=f.key and f.until_at>now();
 select coalesce(jsonb_agg(jsonb_build_object('id',q.key,'name',q.name,'kind',q.kind,'fingerprint',q.fingerprint,'expiresAt',extract(epoch from q.expires_at)*1000)||q.evidence order by (q.evidence->>'score')::integer desc,q.name),'[]') into suggestions
 from public.household_proactive_queue q where q.household_id=hid and q.status='ranked' and q.expires_at>now();
 select coalesce(jsonb_object_agg(f.key,jsonb_build_object('action',f.action,'at',extract(epoch from f.at)*1000,'until',extract(epoch from f.until_at)*1000,'corrections',f.corrections,'counts',f.counts)),'{}') into feedback
 from public.household_proactive_feedback f where f.household_id=hid;
 -- Reading is the display boundary; suggestions are deterministically rebuilt.
 update public.household_proactive_queue set status='displayed' where household_id=hid and status='ranked';
 return jsonb_build_object('suggestions',suggestions,'feedback',feedback);
end $$;

create or replace function public.respond_proactive_suggestions(hid uuid,items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;c record;s public.household_records;f public.household_proactive_feedback;
 n text;k text;a text;fp text;u text;days numeric;corrections integer;counts jsonb;changes jsonb:='[]';added integer:=0;begin
 perform 1 from public.households where id=hid for update;
 if not public.is_household_member(hid) then raise exception 'Household access denied';end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 5 then raise exception 'Invalid feedback';end if;
 for item in select * from jsonb_array_elements(items) loop
  n:=item->>'name';k:='product:'||lower(trim(n));a:=item->>'action';fp:=item->>'fingerprint';u:=item->>'unit';days:=7;
  if n is null or length(n) not between 1 and 160 or a is null or a not in ('accepted','dismissed','later','still_here') or fp is null then raise exception 'Invalid feedback';end if;
  select * into f from public.household_proactive_feedback where household_id=hid and key=k;
  -- A retry after a lost response must not add quantities or record feedback twice.
  if f.action=a and f.fingerprint=fp and f.until_at>now() then continue;end if;
  select * into s from public.household_records where household_id=hid and bucket='stock' and key=n;
  if item->>'kind'='review' then
   if a='accepted' or s.value is null or s.value not in ('1'::jsonb,'2'::jsonb) or fp is distinct from 'review:'||s.revision::text then raise exception 'Conflict: suggestion changed' using errcode='40001';end if;
  else
   select * into c from public.proactive_candidates(hid) p where p.name=n and p.kind=item->>'kind';
   if not found or c.fingerprint is distinct from fp then raise exception 'Conflict: suggestion changed' using errcode='40001';end if;
   days:=coalesce((c.evidence->>'days')::numeric,7);
  end if;
  if a='accepted' then
   if u is null or u not in ('db','kg','g','l','ml','csomag','doboz','üveg','pohár') then raise exception 'Invalid unit';end if;
   -- Preserve all fields on any concurrently added item, including checked ones.
   if not exists(select 1 from public.household_records where household_id=hid and bucket='cart' and lower(trim(key))=lower(trim(n)) and value is not null) then
    changes:=changes||jsonb_build_array(jsonb_build_object('bucket','cart','key',n,'expected',coalesce((select revision from public.household_records where household_id=hid and bucket='cart' and key=n),0),
     'value',jsonb_build_object('name',n,'quantity',1,'unit',u,'done',false,'source','Morzsa javaslata')));added:=added+1;
   end if;
  elsif a='still_here' then
   if s.value is null or s.value='0'::jsonb then changes:=changes||jsonb_build_array(jsonb_build_object('bucket','stock','key',n,'expected',coalesce(s.revision,0),'value',2));end if;
  end if;
  if jsonb_array_length(changes)>0 then perform public.apply_household_changes(hid,changes);changes:='[]';end if;
  if a='still_here' then perform public.confirm_pantry_items(hid,jsonb_build_array(jsonb_build_object('name',n,'revision',(select revision from public.household_records where household_id=hid and bucket='stock' and key=n))));end if;
  corrections:=coalesce(f.corrections,0)+case when a='still_here' then 1 else 0 end;
  counts:=coalesce(f.counts,'{}')||jsonb_build_object(a,coalesce((f.counts->>a)::integer,0)+1);
  days:=case when a='later' then 3 when a='still_here' then greatest(7,least(60,days*(1+least(corrections,3)*.25))) when a='dismissed' then 7 else 2 end;
  insert into public.household_proactive_feedback(household_id,key,action,fingerprint,until_at,corrections,counts) values(hid,k,a,fp,now()+days*interval '1 day',corrections,counts)
  on conflict(household_id,key) do update set action=excluded.action,fingerprint=excluded.fingerprint,at=now(),until_at=excluded.until_at,corrections=excluded.corrections,counts=excluded.counts;
 end loop;
 return public.read_proactive_suggestions(hid)||jsonb_build_object('added',added);
end $$;
revoke all on function public.proactive_date(text),public.proactive_candidates(uuid),public.read_proactive_suggestions(uuid),public.respond_proactive_suggestions(uuid,jsonb) from public;
grant execute on function public.read_proactive_suggestions(uuid),public.respond_proactive_suggestions(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
