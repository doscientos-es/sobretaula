-- A venue has one map composed of editable areas. Geometry belongs to each
-- area directly; there is no plan container or plan lifecycle.
alter table public.areas
  add column width_cm integer not null default 800 check (width_cm > 0),
  add column height_cm integer not null default 600 check (height_cm > 0);

update public.areas area
set
  width_cm = plan.width_cm,
  height_cm = plan.height_cm
from public.floor_plans plan
where plan.area_id = area.id;

alter table public.plan_elements add column area_id uuid;
alter table public.table_placements add column area_id uuid;

update public.plan_elements element
set area_id = plan.area_id
from public.floor_plans plan
where plan.id = element.floor_plan_id;

update public.table_placements placement
set area_id = plan.area_id
from public.floor_plans plan
where plan.id = placement.floor_plan_id;

alter table public.plan_elements alter column area_id set not null;
alter table public.table_placements alter column area_id set not null;

alter table public.plan_elements
  drop constraint plan_elements_floor_plan_id_fkey,
  drop column floor_plan_id,
  add constraint plan_elements_area_id_fkey
    foreign key (area_id) references public.areas (id) on delete cascade;

alter table public.tables
  add constraint tables_id_area_id_key unique (id, area_id);

alter table public.table_placements
  drop constraint table_placements_floor_plan_id_fkey,
  drop constraint table_placements_floor_plan_id_table_id_key,
  drop column floor_plan_id,
  add constraint table_placements_area_id_fkey
    foreign key (area_id) references public.areas (id) on delete cascade,
  add constraint table_placements_table_id_area_id_fkey
    foreign key (table_id, area_id) references public.tables (id, area_id) on delete cascade,
  add constraint table_placements_area_id_table_id_key unique (area_id, table_id);

drop index if exists public.plan_elements_floor_plan_idx;
create index plan_elements_area_idx on public.plan_elements (area_id);

drop table public.floor_plans;

comment on table public.areas is
  'The areas that compose a venue floor map, including each area dimensions.';
comment on column public.areas.width_cm is 'Width of the area map in centimetres.';
comment on column public.areas.height_cm is 'Height of the area map in centimetres.';
comment on column public.plan_elements.area_id is 'Area where this visual map element is placed.';
comment on column public.table_placements.area_id is 'Area where this table is placed; it must match the table area.';