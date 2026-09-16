-- Every tenant starts with the ordinary yearly invoice series. The trigger is
-- idempotent so it also covers tenants provisioned by different entry points.
create or replace function public.ensure_default_invoice_series()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.invoice_series (tenant_id, code, fiscal_year)
  values (new.id, 'A-' || extract(year from current_date)::text, extract(year from current_date)::smallint)
  on conflict (tenant_id, code, fiscal_year) do nothing;
  return new;
end;
$$;

revoke execute on function public.ensure_default_invoice_series() from public, anon, authenticated;

drop trigger if exists tenants_default_invoice_series on public.tenants;
create trigger tenants_default_invoice_series
after insert on public.tenants
for each row execute function public.ensure_default_invoice_series();

insert into public.invoice_series (tenant_id, code, fiscal_year)
select id, 'A-' || extract(year from current_date)::text, extract(year from current_date)::smallint
from public.tenants
on conflict (tenant_id, code, fiscal_year) do nothing;
