-- Additive latency optimization: acquire the existing owner-only lease, then
-- read history in the same transaction and network round trip. Old RPCs remain.
create or replace function public.begin_conversation_turn_page(cid uuid, tid uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.begin_conversation_turn(cid,tid) then
  return jsonb_build_object('acquired',false);
 end if;
 return jsonb_build_object('acquired',true,'page',public.conversation_page(cid));
end;
$$;
revoke all on function public.begin_conversation_turn_page(uuid,uuid) from public,anon;
grant execute on function public.begin_conversation_turn_page(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
