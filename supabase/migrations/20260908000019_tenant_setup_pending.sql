-- Un tenant recién creado no puede operar hasta que el titular haya autorizado
-- el método de pago del SaaS. No reutilizamos `trial`, que sí es operativo.
alter type public.tenant_status add value if not exists 'setup_pending' before 'trial';