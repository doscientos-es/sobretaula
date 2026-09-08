-- Extensiones, tipos y utilidades comunes.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.tenant_status as enum ('trial', 'active', 'suspended');
create type public.platform_role as enum ('platform_owner', 'platform_support');
create type public.tenant_role as enum ('owner', 'manager', 'host', 'waiter', 'accountant');
create type public.membership_status as enum ('invited', 'active', 'suspended');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
create type public.app_locale as enum ('es', 'ca');

create type public.reservation_status as enum (
  'pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'
);
create type public.reservation_source as enum ('staff', 'web', 'phone', 'walk_in', 'partner');
create type public.table_shape as enum ('square', 'rectangle', 'round', 'oval', 'custom');
create type public.plan_element_kind as enum ('wall', 'door', 'window', 'bar', 'stairs', 'plant', 'label', 'other');
create type public.session_status as enum ('open', 'closed', 'voided');
create type public.payment_method as enum ('cash', 'card', 'transfer', 'voucher', 'other');
create type public.invoice_status as enum ('draft', 'issued', 'registered', 'rejected', 'voided');
create type public.verifactu_env as enum ('test', 'prod');
create type public.verifactu_outbox_status as enum (
  'pending', 'processing', 'retryable_error', 'accepted', 'rejected', 'terminal_error'
);

-- Mantiene updated_at sin depender de la aplicación.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bloquea UPDATE y DELETE en tablas append-only (cadena fiscal, auditoría).
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only_table:%', tg_table_name using errcode = '42501';
end;
$$;
