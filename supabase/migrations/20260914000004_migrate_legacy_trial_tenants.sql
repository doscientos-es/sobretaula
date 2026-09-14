-- The product flow is onboarding/payment first, then active. Migrate any
-- tenants created with the former trial state back to the onboarding gate.
update public.tenants
set status = 'setup_pending'
where status = 'trial';

alter table public.tenants
  alter column status set default 'setup_pending';
