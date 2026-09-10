# ADR-0002 · Multitenancy con base única y RLS

- Estado: aceptado (2026-09-08).
- Decide: aislamiento de datos entre restaurantes y entre planos global/tenant.

## Contexto

SaaS de suscripción con muchos restaurantes pequeños. Se descartan base por
tenant (coste operativo y de migración desproporcionado a esta escala) y esquema
por tenant (migraciones multiplicadas, pooling degradado).

## Decisión

Una base Postgres, `tenant_id uuid not null references tenants(id)` en **toda**
tabla de negocio, `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY` en
todas ellas, sin excepción.

La pertenencia se resuelve con una función estable:

```sql
create function app.is_member_of(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = target_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;
```

`SECURITY DEFINER` con `search_path` fijo evita la recursión de políticas al
consultar `memberships` desde una política sobre `memberships`. Se concede
`execute` únicamente a `authenticated`.

Políticas separadas por operación, con `USING` para las filas visibles y
`WITH CHECK` para las filas nuevas o modificadas. Nunca una única política
`FOR ALL` que deje escribir un `tenant_id` ajeno.

El `tenant_id` **nunca** se acepta del formulario ni del cliente: se deriva en
servidor del slug de la ruta y se autoriza contra `memberships` en cada
operación.

## Plano global

`platform_members` identifica a los operadores de Doscientos
(`platform_owner`, `platform_support`). Sus políticas cubren tablas de
plataforma (`tenants`, `subscriptions`, `plan_entitlements`), no el dato
operativo. El acceso de soporte a un tenant es una operación explícita,
temporal y registrada en `support_access_log`; no un `OR is_platform_admin()`
suelto en cada política, que convertiría cualquier fallo en fuga total.

## Consecuencias

- `service_role` solo en tareas privilegiadas justificadas, server-only y con
  autorización explícita previa. Omite RLS: cada uso se documenta.
- Índices compuestos con `tenant_id` como primera columna en todo acceso
  frecuente; si no, RLS degrada los planes de consulta.
- Storage privado con políticas equivalentes y ruta canónica `tenant_id/...`.
  Nunca se firma una clave de almacenamiento aportada por el consumidor.
- Pruebas obligatorias desde F1: dos tenants no se ven entre sí, endpoint
  directo con tenant ajeno → 403, anónimo → 401, `tenant_id` falsificado en el
  cuerpo → rechazo, cambio de tenant purga la caché de Query.
- Un repositorio mock no prueba políticas. Mientras exista un único proyecto
  Supabase con datos reales, las pruebas RLS que requieran usuarios o fixtures
  permanecen omitidas y se revisan las políticas y grants por migración; nunca
  se ejecutan contra producción.
