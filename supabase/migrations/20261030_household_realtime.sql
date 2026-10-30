-- Add only the existing household record table to Realtime. Existing RLS remains
-- in force; no grants, ownership, RPC or record format changes.
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='household_records') then
  alter publication supabase_realtime add table public.household_records;
 end if;
end $$;
