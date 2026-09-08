-- RLS de reservas. La configuración la toca dirección; la sala del día, el equipo.

select public.apply_tenant_rls('services', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('availability_rules', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('closures', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('guests', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_tenant_rls('reservations', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('reservation_tables', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('holds', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_tenant_rls('waitlist', array['owner', 'manager', 'host']::public.tenant_role[]);
