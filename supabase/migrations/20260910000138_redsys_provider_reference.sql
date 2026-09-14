alter table public.platform_payment_attempts
  add column if not exists provider_reference text;

create index if not exists platform_payment_attempts_provider_reference_idx
  on public.platform_payment_attempts (provider_reference)
  where provider_reference is not null;
