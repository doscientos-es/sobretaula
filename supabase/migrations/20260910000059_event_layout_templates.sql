create table public.event_layout_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  area_ids uuid[] not null check (array_length(area_ids, 1) > 0),
  layout jsonb not null,
  active_from timestamptz not null,
  active_to timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_to is null or active_to > active_from)
);

create index event_layout_templates_venue_idx
  on public.event_layout_templates (tenant_id, venue_id, active_from desc);

create trigger event_layout_templates_set_updated_at before update on public.event_layout_templates
  for each row execute function public.set_updated_at();

select public.apply_tenant_rls('event_layout_templates', array['owner', 'manager']::public.tenant_role[]);
