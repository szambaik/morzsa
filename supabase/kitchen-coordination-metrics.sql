-- Private operator/pilot query. Do not expose raw event/actor data publicly.
-- Accepted changed records only, never messages, retry requests or no-op writes.
with meaningful as (
 select household_id,actor_id,date_trunc('week',created_at at time zone 'Europe/Budapest') as week,event_type
 from public.household_kitchen_events
 where item_count>0 and event_type<>'preferences_updated'
),household_weeks as (
 select week,household_id,count(*) as coordination_events,count(distinct actor_id) as active_members,
 count(*) filter(where event_type='recipe_started') as recipe_starts,
 count(*) filter(where event_type='recipe_completed') as recipe_completions,
 count(*) filter(where event_type='shopping_completed') as shopping_trips
 from meaningful group by week,household_id
)
select week,count(*) as weekly_active_households,
 count(*) filter(where active_members>=2) as households_with_two_active_members,
 sum(coordination_events) as weekly_household_coordination_events,
 sum(recipe_starts) as cooking_starts,sum(recipe_completions) as cooking_completions,sum(shopping_trips) as completed_shopping_trips
from household_weeks group by week order by week desc;
-- These are aggregate observations, not retention or conversion probabilities.
-- Compare the same recruited household cohort across four weeks for retention.
