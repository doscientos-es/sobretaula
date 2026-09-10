-- Extiende las áreas del plano sin romper locales existentes.
-- Pendiente de aplicar/verificar en el proyecto Supabase conectado.

alter table public.areas
  add column if not exists floor_number integer,
  add column if not exists space_type text not null default 'indoor',
  add column if not exists outdoor_open boolean not null default true;

alter table public.areas
  add constraint areas_floor_number_reasonable
    check (floor_number is null or floor_number between -2 and 200),
  add constraint areas_space_type_valid
    check (space_type in ('indoor', 'covered_terrace', 'outdoor_terrace', 'other'));

create index if not exists areas_venue_floor_idx
  on public.areas (venue_id, floor_number, name);

comment on column public.areas.floor_number is 'Planta física; null conserva compatibilidad con áreas antiguas.';
comment on column public.areas.space_type is 'Tipo operativo del espacio del plano.';
comment on column public.areas.outdoor_open is 'Indica si una zona exterior está abierta para operar.';
