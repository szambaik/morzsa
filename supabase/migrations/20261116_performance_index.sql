-- Preserve the existing owner/shared contract while avoiding one access-function
-- evaluation per unrelated conversation. No records or RLS policies are changed.
create index if not exists household_members_user_household on public.household_members(user_id,household_id);
create index if not exists conversation_shares_household on public.conversation_shares(household_id,conversation_id);

create or replace function public.conversation_index(page_offset int default 0) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'owner',c.owner_id=auth.uid(),'metadata',case when c.owner_id=auth.uid() then c.metadata||coalesce((select jsonb_build_object('parentId',p.parent_id) from public.conversation_private_context p where p.conversation_id=c.id),'{}'::jsonb) else (c.metadata-'parentId'-'archivedAt')||case when u.archived_at is not null then jsonb_build_object('archivedAt',extract(epoch from u.archived_at)*1000) else '{}'::jsonb end end,'revision',c.revision,'updated',extract(epoch from c.updated_at)*1000,'sharedHousehold',s.household_id) order by c.updated_at desc,c.id),'[]') from (
  select visible.* from (
   select own.* from public.conversations own
   where own.owner_id=auth.uid() and own.deleted_at is null
   union all
   select shared.* from public.household_members member
   join public.conversation_shares share on share.household_id=member.household_id
   join public.conversations shared on shared.id=share.conversation_id
   where member.user_id=auth.uid() and shared.owner_id<>auth.uid() and shared.deleted_at is null
  ) visible order by updated_at desc,id limit 100 offset greatest(page_offset,0)
 ) c left join public.conversation_shares s on s.conversation_id=c.id left join public.conversation_user_state u on u.conversation_id=c.id and u.user_id=auth.uid();
$$;
