# SobreTaula · Diseño del producto y de la plataforma

Estado: diseño aprobado para F0; implementación del MVP avanzada, pero no
entregable aprobado. Última revisión: 2026-09-09.

Este documento es la fuente de verdad del diseño. Las decisiones con coste de
reversión alta viven en `docs/adr/`. El avance real vive en
`docs/implementation-status.md`. Si el código y este documento discrepan, gana el
código y este documento se corrige en el mismo PR.

La secuencia de producto para completar el MVP operativo vive en
[mvp-roadmap.md](./mvp-roadmap.md). No altera el estado de implementación: fija
el orden de los próximos trabajos para que las funcionalidades se conviertan en
valor operativo antes de ampliar el alcance.

## 1. Producto

SaaS de suscripción para gestión integral de restaurantes independientes en
España. Un único producto modular, no una suite de aplicaciones sueltas.

**Tesis de producto:** _el plano del restaurante es el producto_. Reserva,
servicio, cuenta y factura se operan desde la misma escena visual. Cuota fija
sin comisión por cubierto; el dato del comensal es del restaurante.

### Usuarios

| Perfil                | Dispositivo             | Necesidad dominante                    |
| --------------------- | ----------------------- | -------------------------------------- |
| Propietario / gerente | Escritorio              | Configuración, facturación, informes   |
| Jefe de sala / host   | Tablet en atril, de pie | Plano en vivo, sentar, mover, unir     |
| Camarero              | Móvil                   | Añadir a la cuenta, cobrar             |
| Comensal              | Móvil web               | Reservar sin fricción (fase posterior) |
| Operador Doscientos   | Escritorio              | Alta de tenants, soporte, planes       |

El jefe de sala es el usuario crítico: si el plano no responde al instante y con
el dedo, el producto no se usa.

### Módulos

| Módulo                                       | Fase      | Estado                                             |
| -------------------------------------------- | --------- | -------------------------------------------------- |
| Tenancy, auth, roles, ajustes                | F1        | Alcance MVP                                        |
| Diseñador de sala                            | F2        | Alcance MVP                                        |
| Motor de reservas                            | F3        | Alcance MVP                                        |
| Vista de servicio                            | F4        | Alcance MVP                                        |
| Cuenta de mesa (simple)                      | F5        | Alcance MVP                                        |
| Facturación + VERI\*FACTU                    | F6        | Alcance MVP, modo test                             |
| TPV completo (comandas, cocina, arqueo)      | Posterior | Modelo preparado                                   |
| Web pública de reservas                      | R4        | Planificada; ver `reservations-completion-plan.md` |
| Delivery, fidelización, inventario, informes | Posterior | Fuera de alcance                                   |

La regla de escalabilidad es estructural, no aspiracional: cada módulo es un
vertical en `src/features/<modulo>` con su dominio, aplicación, infraestructura
y UI, y una API pública pequeña en `index.ts`. Añadir un módulo no debe obligar
a tocar otro. Ver [ADR-0006](./adr/0006-arquitectura-modular.md).

### Política comercial inicial

El producto se vende como una operación de sala integrada, no como módulos
separados: plano, reservas, servicio, cuenta y facturación básica pertenecen al
plan **SobreTaula Sala**. El precio público es 149 EUR/mes netos e incluye el
primer local; cada local adicional suma 75 EUR/mes netos. Se reservan hasta diez
plazas **Founders** a 99 EUR/mes netos mientras mantengan la suscripción. La
tarifa Founder no es una promoción temporal ni se aplica a los locales extra.

Las futuras capacidades que sí puedan contratarse independientemente —reservas
públicas, depósitos/no-shows, TPV de comandas y cocina, integraciones o analítica
avanzada— se podrán ofrecer como complementos cuando estén disponibles.

La ampliación de reservas (agenda, autoservicio público, avisos, espera, ficha de
cliente y grupos) tiene su desglose de datos, seguridad, entregas y validación en
[`reservations-completion-plan.md`](./reservations-completion-plan.md). Hasta que
se complete, la reserva web y los depósitos no se consideran disponibles.

## 2. Arquitectura

TanStack Start (React 19, Router, Query, Tailwind v4) sobre runtime Node, con
Supabase como Postgres + Auth + Storage + RLS. Justificación y riesgos en
[ADR-0001](./adr/0001-stack-tanstack-start.md).

```
src/
  app/                     router, QueryClient, providers, shell
  routes/                  URL, params/search validados, loaders, estados
  features/<modulo>/
    domain/                reglas puras, sin React ni IO
    application/           schemas, queries, casos de uso, *.functions.ts
    infrastructure/        adaptadores *.server.ts (Supabase, PDF, AEAT)
    ui/                    un componente por archivo
    index.ts               API pública client-safe
  shared/lib/              supabase, auth, i18n, reloj, dinero
  demos/                   fixtures deterministas
supabase/migrations/       SQL versionado, pequeño e incremental
docs/                      este diseño, ADRs, estado
```

Contratos que no se negocian:

- La URL pertenece al Router; la caché remota a Query; las primitivas visuales a
  `@doscientos/ui`. Las rutas no conocen Supabase.
- Toda operación privada se autoriza **al invocarla**, no en `beforeLoad`.
- El tenant de la URL es un **selector**, nunca prueba de pertenencia.
- Código fiscal y certificados: solo en `.server.ts`, nunca en el bundle cliente.
- Un componente por archivo. Sin `any` ni casts para tapar incompatibilidades.

## 3. Multitenancy y perfiles

Una sola base Postgres, `tenant_id uuid not null` en toda tabla de negocio, RLS
obligatoria. Detalle en [ADR-0002](./adr/0002-multitenancy-rls.md) y en
[`data-model.md`](./data-model.md).

Dos planos de identidad desde el día 0:

| Plano                | Tabla              | Roles                                              | Alcance                                                          |
| -------------------- | ------------------ | -------------------------------------------------- | ---------------------------------------------------------------- |
| Global (Doscientos)  | `platform_members` | `platform_owner`, `platform_support`               | Alta de tenants, planes, suspensión, soporte con acceso auditado |
| Tenant (restaurante) | `memberships`      | `owner`, `manager`, `host`, `waiter`, `accountant` | Todo el dato operativo de su tenant                              |

Un perfil global **no** hereda acceso a datos operativos por defecto: opera
sobre tablas de plataforma y, para entrar en un tenant, deja rastro en
`support_access_log`. Suscripción y límites de plan viven en `subscriptions` y
`plan_entitlements`; un módulo desactivado por plan se bloquea en servidor, no
solo ocultando el enlace.

La consola de superadministración queda reservada a `platform_owner`: muestra
salud de tenants, MRR estimado, saldo pendiente y revisiones fiscales. Los
cambios manuales de estado sólo admiten `active` o `suspended`, exigen motivo y
se registran. Las altas de operadores usan invitaciones de un solo uso, con
token almacenado como hash y ligado al correo autenticado; no se permite
revocar, degradar ni modificar el acceso propio, ni eliminar el último owner.

Sin dominio propio todavía: el tenant se selecciona por ruta `/t/:slug`. El
código aísla la resolución en `shared/lib/tenant` para que añadir subdominios
sea un cambio de una función. Ver [ADR-0003](./adr/0003-resolucion-tenant.md).

El alta es autoservicio: el propietario crea su cuenta en `/registro`, completa
la ficha inicial del restaurante en `/onboarding` y la transacción crea tenant,
perfil de facturación, suscripción y primer local. Después puede preparar la
plantilla desde `/t/:slug/equipo`: una cuenta existente se incorpora de inmediato
y una nueva recibe un enlace de un solo uso para elegir contraseña y aceptar su
rol. Los managers solo administran host, camareros y administración; el owner
no puede perderse ni modificarse desde esa pantalla.

## 4. Internacionalización

La UI es multilingüe desde el primer commit: castellano y catalán, con inglés
preparado. El dato de negocio del tenant (nombres de mesa, carta) no se traduce
automáticamente; los catálogos que lo necesiten usan columnas `jsonb` por
idioma. Ver [ADR-0004](./adr/0004-i18n.md).

## 5. Facturación y VERI\*FACTU

`@doscientos/billing` calcula; `@doscientos/verifactu` emite; la aplicación
aporta persistencia atómica (ledger + outbox), mapper y UI. El MVP opera en
`VERIFACTU_ENV=test` por tenant, conmutable a `prod` sin cambio de código.

El certificado `.pfx` de cada restaurante se sube desde sus ajustes por un
endpoint servidor, se cifra en reposo y solo el runtime Node lo descifra al
emitir. Nunca llega al navegador ni a una variable `VITE_*`. Ver
[ADR-0005](./adr/0005-certificados-verifactu.md).

**Reparto de responsabilidad legal:** Doscientos es _productor_ del SIF y asume
la declaración responsable del RD 1007/2023; cada restaurante es el _obligado
tributario_ que responde del contenido de sus facturas. Detalle y límites en el
ADR-0005. No es asesoramiento legal: requiere validación de un asesor fiscal
antes de habilitar `prod`.

## 6. Calidad y entrega

Contrato completo en cada cierre de tarea y en CI: `pnpm format:check`,
`pnpm lint`, `pnpm structure:check`, `pnpm typecheck`, `pnpm test`,
`pnpm quality`, `pnpm build`. La última ejecución local completa todos los
controles, incluidos `typecheck`, `quality` y `build`; el detalle y las
evidencias viven en `docs/implementation-status.md`.

Desde F1 se añaden pruebas de integración de RLS y concurrencia contra una base
Supabase de pruebas, nunca producción. Las migraciones de gobierno global ya
están aplicadas y verificadas en el proyecto de producción. Aún no hay un
proyecto de pruebas dedicado, por lo que las pruebas RLS quedan omitidas y no
se ejecuta ningún humo contra producción.
