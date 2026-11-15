-- Additive portion and equipment metadata validation; immutable recipes stay unchanged.
create or replace function public.save_recipe_document(rid uuid, recipe jsonb, labels text[] default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid; digest text; begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if rid is null or jsonb_typeof(recipe)<>'object' or octet_length(recipe::text)>20000 or length(recipe->>'title') not between 1 and 100 or length(recipe->>'summary') not between 1 and 400 or jsonb_typeof(recipe->'ingredients') is distinct from 'array' or jsonb_array_length(recipe->'ingredients') not between 1 and 15 or jsonb_typeof(recipe->'steps') is distinct from 'array' or jsonb_array_length(recipe->'steps') not between 1 and 6 or coalesce((recipe->>'minutes')::int,0) not between 1 and 240 then raise exception 'Invalid recipe';end if;
 if jsonb_typeof(recipe->'title') is distinct from 'string' or jsonb_typeof(recipe->'summary') is distinct from 'string' or exists(select 1 from jsonb_array_elements(recipe->'ingredients') i where jsonb_typeof(i->'name') is distinct from 'string' or jsonb_typeof(i->'amount') is distinct from 'string' or length(i->>'name') not between 1 and 80 or length(i->>'amount') not between 1 and 80) or exists(select 1 from jsonb_array_elements(recipe->'steps') s where jsonb_typeof(s) is distinct from 'string' or length(s#>>'{}') not between 1 and 1000) or array_length(labels,1)>12 then raise exception 'Invalid recipe';end if;
 if recipe ? 'servings' and (jsonb_typeof(recipe->'servings') is distinct from 'number' or (recipe->>'servings')::numeric not between 1 and 24 or mod((recipe->>'servings')::numeric,1)<>0) then raise exception 'Invalid recipe';end if;
 if recipe ? 'equipment' and (jsonb_typeof(recipe->'equipment') is distinct from 'array' or jsonb_array_length(recipe->'equipment')>4 or exists(select 1 from jsonb_array_elements(recipe->'equipment') e where jsonb_typeof(e) is distinct from 'string' or length(e#>>'{}') not between 1 and 100)) then raise exception 'Invalid recipe';end if;
 recipe=recipe-'recipeId'-'curated';digest=encode(sha256(convert_to(recipe::text,'UTF8')),'hex');
 select id into existing from public.recipe_documents where owner_id=auth.uid() and content_hash=digest; if found then return existing;end if;
 if exists(select 1 from public.recipe_documents where id=rid) then
  if exists(select 1 from public.recipe_documents where id=rid and content_hash=digest and public.can_read_recipe(id)) then return rid;end if;
  raise exception 'Recipe identity conflict';
 end if;
 insert into public.recipe_documents(id,owner_id,content_hash,content,tags) values(rid,auth.uid(),digest,recipe,labels) on conflict(owner_id,content_hash) do nothing;
 select id into existing from public.recipe_documents where owner_id=auth.uid() and content_hash=digest;return existing;
end $$;
