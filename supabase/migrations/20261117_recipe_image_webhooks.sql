-- Backend-only callback lookup; no new client grants or changes to existing jobs.
create index if not exists recipe_asset_jobs_provider_request_idx
 on public.recipe_asset_jobs ((provider_request->>'id'))
 where provider_request is not null;
