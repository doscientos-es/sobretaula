-- Every settled platform billing invoice must have a fiscal invoice candidate.
-- This covers the initial Redsys payment, recurring charges and future providers
-- without coupling invoice creation to one payment webhook implementation.

create or replace function public.create_platform_fiscal_invoice_on_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform public.create_platform_fiscal_invoice(new.id);
  end if;
  return new;
end;
$$;

revoke execute on function public.create_platform_fiscal_invoice_on_paid() from public, anon, authenticated;

drop trigger if exists platform_billing_invoice_create_fiscal_on_paid
  on public.platform_billing_invoices;
create trigger platform_billing_invoice_create_fiscal_on_paid
  after update of status on public.platform_billing_invoices
  for each row
  when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.create_platform_fiscal_invoice_on_paid();

-- Recover payments settled before this invariant existed. The unique relation
-- on platform_fiscal_invoices makes this backfill safe to rerun.
do $$
declare
  v_invoice record;
begin
  for v_invoice in
    select b.id
    from public.platform_billing_invoices b
    where b.status = 'paid'
      and not exists (
        select 1
        from public.platform_fiscal_invoices f
        where f.platform_billing_invoice_id = b.id
      )
  loop
    perform public.create_platform_fiscal_invoice(v_invoice.id);
  end loop;
end;
$$;