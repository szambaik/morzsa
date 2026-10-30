-- Additive voice quota. No audio, transcripts or inventory are stored here.
create table if not exists public.voice_command_usage (
 day date not null, scope text not null, calls integer not null default 0,
 primary key(day,scope)
);
alter table public.voice_command_usage enable row level security;
revoke all on public.voice_command_usage from public,anon,authenticated;
create or replace function public.claim_voice_command(user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare day_key date := (now() at time zone 'UTC')::date; total integer; personal integer;
begin
 if user_id is null then return false; end if;
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
revoke all on function public.claim_voice_command(uuid) from public,anon,authenticated;
grant execute on function public.claim_voice_command(uuid) to service_role;
