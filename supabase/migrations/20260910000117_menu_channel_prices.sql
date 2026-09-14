create table public.menu_item_channel_prices (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade, channel text not null check (channel in ('room','web','delivery','takeaway')),
  price_cents integer not null check (price_cents >= 0), unique(tenant_id, menu_item_id, channel)
);
select public.apply_tenant_rls('menu_item_channel_prices', array['owner','manager']::public.tenant_role[]);
