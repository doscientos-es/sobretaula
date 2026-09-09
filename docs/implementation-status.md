# Estado de implementación

Última actualización: 2026-09-09.

Registro honesto de lo que existe y está verificado. Un punto sin ejecutar es
**pendiente**, no aprobado. No se marca nada como hecho sin evidencia
reproducible (comando ejecutado y su resultado).

## Fases

| Fase                   | Entregable                                                                 | Estado  |
| ---------------------- | -------------------------------------------------------------------------- | ------- |
| F0 · Papeleo           | `project-design.md`, `data-model.md`, ADR 0001–0007                        | Hecho   |
| F0 · Esqueleto         | Proyecto Start, `@doscientos/configs`, CI, `.env.example`                  | Hecho   |
| F1 · Tenancy + Auth    | Registro, onboarding, perfiles, equipo, RLS, `/t/:slug`                    | Hecho   |
| F1b · Billing SaaS     | Precios, Founders, cobro Redsys, gracia, facturas SaaS y suspensión segura | Parcial |
| F2 · Diseñador de sala | Editor SVG, snap, historial, elementos y layouts versionados               | Hecho   |
| F3 · Motor de reservas | Turnos, pacing, disponibilidad, best-fit, EXCLUDE                          | Hecho   |
| F4 · Vista de servicio | Plano en vivo, sentar/mover/unir, walk-ins, espera                         | Hecho   |
| F5 · Cuenta de mesa    | Catálogo, líneas, dividir, cerrar, cobrar                                  | Hecho   |
| F6 · Facturación       | Ajustes fiscales, series, ledger/outbox, PDF, modo test                    | Hecho   |
| F7 · Entrega           | Documentación operativa, smoke, despliegue autorizado                      | Parcial |

## Puerta de adopción de TanStack Start (ADR-0001)

| #   | Evidencia                                                            | Estado                                                                                |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Instalación limpia, tipos, lint, tests y build del artefacto Node    | Hecho                                                                                 |
| 2   | Login/logout/expiración y refresh sin caché compartida               | Implementado; verificación manual contra el proyecto existente                        |
| 3   | Endpoint directo: tenant ajeno → 403, anónimo → 401                  | Implementado; cubierto por RLS y middlewares; pendiente de humo dedicado              |
| 4   | Listado con URL, loader, pending/error, reintento, invalidación      | Hecho: estados de root + invalidación en sitio (`useLoaderReload`) en todas las rutas |
| 5   | Emisión concurrente idempotente sin números duplicados               | Implementado: `reserve_invoice_number` usa `for update` en Postgres                   |
| 6   | PDF privado; descarga cruzada denegada; fiscalidad fuera del cliente | Implementado: bucket privado con políticas tenant-scoped                              |
| 7   | Integración fiscal en `mock`/`test` y compatibilidad del runtime     | Pendiente: requiere runtime real y certificado, fuera del MVP                         |

## Checklist previa a VERI\*FACTU `prod` (ADR-0005)

Todo pendiente. Ningún tenant puede activar `prod` hasta cerrarla completa y
hasta que un asesor fiscal valide el reparto de responsabilidad.

## Desviaciones conocidas

| Tema                                                            | Situación                                           | Plan                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doscientos-structure` y sufijos `.server.ts` / `.functions.ts` | El checker inspeccionado no los reconoce            | Documentar la excepción concreta y proponer regresión en `@doscientos/configs`. No desactivar el check ni renombrar archivos                                                                                                                                                    |
| Generador `create-operational-app`                              | Solo produce Vite/Router, no Start                  | Esqueleto construido a mano con los mismos scripts y contratos de calidad                                                                                                                                                                                                       |
| Proyecto Supabase                                               | Creado; migraciones 0001–0022 y 0901–0903 aplicadas | Advisors revisados tras RLS y billing; índices/FKs y denegaciones explícitas incorporados. Persisten sólo los avisos intencionados documentados abajo.                                                                                                                          |
| Helpers `SECURITY DEFINER` visibles para `authenticated`        | Advisor los marca como WARN                         | Es intencionado: `is_member_of`, `has_tenant_role`, `is_platform_*` y `reserve_invoice_number` deben ser invocables para que las políticas RLS funcionen. Solo devuelven booleanos o reservan número validando rol                                                              |
| `tenant_public_by_slug` visible para `anon`                     | Advisor lo marca como WARN                          | Es intencionado: la resolución de `/t/:slug` ocurre antes de haber sesión. Exige el slug exacto y devuelve solo marca (nombre, estado, idioma, zona horaria), así que no permite enumerar tenants                                                                               |
| Redsys recurrente                                               | Adaptador pendiente de terminal propio              | El esquema guarda sólo referencias cifradas e intentos idempotentes. Antes de activar cobros se debe confirmar MIT/tokenización y configurar secretos exclusivos de SobreTaula.                                                                                                 |
| Facturas SaaS y VERI*FACTU de plataforma                        | Cierre mensual automático y outbox listos           | El cron autenticado llama diariamente a la conciliación: genera una vez el último mes cerrado y suspende impagos. Las facturas quedan `pending_review` si falta emisor; el envío certificado que cambia `issued` a `registered` requiere el adaptador VERI*FACTU de plataforma. |

## Comandos de validación

`pnpm format:check`, `pnpm lint`, `pnpm structure:check`, `pnpm typecheck`,
`pnpm test`, `pnpm quality`, `pnpm build`.

Las pruebas de integración de RLS (`tenant-rls.test.ts`) requieren un proyecto
Supabase de pruebas dedicado (`SUPABASE_TEST_URL`,
`SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY`; contrato en
`.env.test.example`). Hoy existe un único proyecto Supabase, que es producción:
no hay base de pruebas, así que la suite queda saltada y **no se ejecuta ningún
humo contra producción**. Cuando exista un proyecto de pruebas, se activan sin
cambios de código y la puerta de adopción (#2, #3, #5, #6) se cierra con esa
evidencia.
