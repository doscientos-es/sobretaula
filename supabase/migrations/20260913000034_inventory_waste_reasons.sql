alter table public.inventory_movements add column if not exists waste_reason text check (waste_reason is null or waste_reason in ('expiry','breakage','overproduction','return','internal_consumption','other'));
alter table public.inventory_movements drop constraint if exists inventory_waste_reason_required;
alter table public.inventory_movements add constraint inventory_waste_reason_required check (kind <> 'waste' or waste_reason is not null);
