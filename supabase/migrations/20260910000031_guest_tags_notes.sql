-- Perfil operativo de cliente: etiquetas rápidas y notas históricas sin perder contexto.

create table public.guest_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9_-]{1,48}$'),
  label text not null check (length(btrim(label)) between 1 and 60),
  color text not null default 'slate',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table public.guest_tag_assignments (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete cascade,
  tag_id uuid not null references public.guest_tags (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (guest_id, tag_id)
);

create table public.guest_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete cascade,
  category text not null default 'general' check (category in ('general', 'preference', 'allergy', 'incident')),
  body text not null check (length(btrim(body)) between 1 and 2000),
  author_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index guest_tag_assignments_guest_idx on public.guest_tag_assignments (tenant_id, guest_id);
create index guest_notes_guest_idx on public.guest_notes (tenant_id, guest_id, created_at desc);

alter table public.guest_tags enable row level security;
alter table public.guest_tags force row level security;
alter table public.guest_tag_assignments enable row level security;
alter table public.guest_tag_assignments force row level security;
alter table public.guest_notes enable row level security;
alter table public.guest_notes force row level security;

create policy guest_tags_read on public.guest_tags for select using (public.is_tenant_member(tenant_id));
create policy guest_tags_write on public.guest_tags for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy guest_tag_assignments_read on public.guest_tag_assignments for select using (public.is_tenant_member(tenant_id));
create policy guest_tag_assignments_write on public.guest_tag_assignments for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy guest_notes_read on public.guest_notes for select using (public.is_tenant_member(tenant_id));
create policy guest_notes_write on public.guest_notes for insert with check (public.is_tenant_member(tenant_id));

create or replace function public.prevent_system_guest_tag_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.is_system then raise exception 'system_guest_tag_protected'; end if;
  return old;
end;
$$;

create trigger guest_tags_protect_system
  before delete on public.guest_tags
  for each row execute function public.prevent_system_guest_tag_delete();
