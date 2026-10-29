-- Apply after schema.sql, including to existing projects. Safe to rerun.
create table if not exists public.household_email_invites (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 email text not null check(length(email) between 3 and 254),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 status text not null default 'pending' check(status in ('pending','accepted','declined','revoked')),
 unique(household_id,email)
);
alter table public.household_email_invites enable row level security;
revoke all on public.household_email_invites from public,anon,authenticated;

-- Use the server-side, confirmed email, never a client-supplied claim or user metadata.
create or replace function public.household_verified_email() returns text language sql stable security definer set search_path='' as $$
 select lower(trim(email)) from auth.users where id=auth.uid() and email_confirmed_at is not null;
$$;
create or replace function public.send_household_email_invite(hid uuid, recipient_email text) returns uuid language plpgsql security definer set search_path='' as $$
declare target text=lower(trim(recipient_email)); iid uuid; begin
 perform 1 from public.households where id=hid and owner_id=auth.uid() for update;
 if not found then raise exception 'Owner access required';end if;
 if target is null or length(target)>254 or target !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Invalid email';end if;
 if target=public.household_verified_email() then raise exception 'Cannot invite yourself';end if;
 if (select count(*) from public.household_email_invites where household_id=hid and status='pending' and expires_at>now() and email<>target)>=50 then raise exception 'Too many pending invitations';end if;
 insert into public.household_email_invites(household_id,email) values(hid,target)
 on conflict(household_id,email) do update set status='pending',created_at=now(),expires_at=now()+interval '7 days'
 returning id into iid;return iid;
end $$;
create or replace function public.list_household_email_invites() returns table(id uuid,household_id uuid,household_name text,expires_at timestamptz) language sql stable security definer set search_path='' as $$
 select i.id,i.household_id,h.name,i.expires_at from public.household_email_invites i join public.households h on h.id=i.household_id
 where i.email=public.household_verified_email() and i.status='pending' and i.expires_at>now() order by i.created_at desc;
$$;
create or replace function public.respond_household_email_invite(invitation_id uuid, accept_invite boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.household_email_invites; begin
 select * into inv from public.household_email_invites where id=invitation_id for update;
 if not found or inv.email is distinct from public.household_verified_email() or inv.status<>'pending' or inv.expires_at<=now() or accept_invite is null then raise exception 'Invitation unavailable';end if;
 if accept_invite then insert into public.household_members values(inv.household_id,auth.uid()) on conflict do nothing;end if;
 update public.household_email_invites set status=case when accept_invite then 'accepted' else 'declined' end where id=inv.id;
 return case when accept_invite then inv.household_id else null end;
end $$;
create or replace function public.list_sent_household_invites(hid uuid) returns table(id uuid,email text,status text,expires_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.households where households.id=hid and owner_id=auth.uid()) then raise exception 'Owner access required';end if;
 return query select i.id,i.email,i.status,i.expires_at from public.household_email_invites i where i.household_id=hid order by i.created_at desc;
end $$;
create or replace function public.revoke_household_email_invite(invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.household_email_invites i set status='revoked' where i.id=invitation_id and i.status='pending' and exists(select 1 from public.households h where h.id=i.household_id and h.owner_id=auth.uid());
 if not found then raise exception 'Owner access required';end if;
end $$;
revoke all on function public.household_verified_email(),public.send_household_email_invite(uuid,text),public.list_household_email_invites(),public.respond_household_email_invite(uuid,boolean),public.list_sent_household_invites(uuid),public.revoke_household_email_invite(uuid) from public,anon;
grant execute on function public.send_household_email_invite(uuid,text),public.list_household_email_invites(),public.respond_household_email_invite(uuid,boolean),public.list_sent_household_invites(uuid),public.revoke_household_email_invite(uuid) to authenticated;
-- Retire bearer-code joining: membership now requires the addressed, verified account.
revoke execute on function public.invite_household(uuid),public.join_household(text) from authenticated;
notify pgrst, 'reload schema';
