-- A venue has one operational plan per area. Historical and scheduled plan
-- versions are deliberately consolidated into that one editable record.
with ranked_plans as (
  select
    id,
    row_number() over (
      partition by area_id
      order by
        case
          when active_from <= statement_timestamp()
            and (active_to is null or statement_timestamp() < active_to) then 0
          else 1
        end,
        active_from desc,
        created_at desc,
        id desc
    ) as position
  from public.floor_plan_versions
)
delete from public.floor_plan_versions floor_plan_version
using ranked_plans ranked
where floor_plan_version.id = ranked.id
  and ranked.position > 1;

alter table public.floor_plan_versions rename to floor_plans;
alter table public.floor_plans
  drop column active_from,
  drop column active_to,
  drop column name,
  add column updated_at timestamptz not null default now(),
  add constraint floor_plans_area_id_key unique (area_id);

alter table public.plan_elements rename column floor_plan_version_id to floor_plan_id;
alter table public.table_placements rename column floor_plan_version_id to floor_plan_id;

alter index if exists public.floor_plan_versions_area_idx rename to floor_plans_area_idx;
alter index if exists public.floor_plan_versions_tenant_idx rename to floor_plans_tenant_idx;
alter index if exists public.floor_plan_versions_author_idx rename to floor_plans_author_idx;
alter index if exists public.plan_elements_version_idx rename to plan_elements_floor_plan_idx;

alter table public.plan_elements
  rename constraint plan_elements_floor_plan_version_id_fkey to plan_elements_floor_plan_id_fkey;
alter table public.table_placements
  rename constraint table_placements_floor_plan_version_id_fkey to table_placements_floor_plan_id_fkey;
alter table public.table_placements
  rename constraint table_placements_floor_plan_version_id_table_id_key
  to table_placements_floor_plan_id_table_id_key;

create trigger floor_plans_set_updated_at before update on public.floor_plans
  for each row execute function public.set_updated_at();

comment on table public.floor_plans is
  'The single operational floor plan for each area.';
comment on column public.table_placements.is_locked is
  'Prevents accidental movement while editing an operational floor plan.';

drop policy if exists floor_plan_versions_read on public.floor_plans;
drop policy if exists floor_plan_versions_insert on public.floor_plans;
drop policy if exists floor_plan_versions_update on public.floor_plans;
drop policy if exists floor_plan_versions_delete on public.floor_plans;
select public.apply_configuration_rls('floor_plans', array['owner', 'manager']::public.tenant_role[]);