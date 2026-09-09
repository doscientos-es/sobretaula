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
| F1 · Tenancy + Auth    | Migraciones, RLS, `/t/:slug`, perfiles global y tenant                     | Parcial |
| F1b · Billing SaaS     | Precios, Founders, cobro Redsys, gracia, facturas SaaS y suspensión segura | Parcial |
| F2 · Diseñador de sala | Editor SVG, snap, historial, elementos y layouts versionados               | Hecho   |
| F3 · Motor de reservas | Turnos, pacing, disponibilidad, best-fit, EXCLUDE                          | Hecho   |
| F4 · Vista de servicio | Plano en vivo, sentar/mover/unir, walk-ins, espera                         | Hecho   |
| F5 · Cuenta de mesa    | Catálogo, líneas, dividir, cerrar, cobrar                                  | Hecho   |
| F6 · Facturación       | Ajustes fiscales, series, ledger/outbox, PDF, modo test                    | Hecho   |
| F7 · Entrega           | Documentación operativa, smoke, despliegue autorizado                      | Parcial |

## Puerta de adopción de TanStack Start (ADR-0001)

| #   | Evidencia                                                            | Estado                                                                                   |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Instalación limpia, tipos, lint, tests y build del artefacto Node    | Hecho                                                                                    |
| 2   | Login/logout/expiración y refresh sin caché compartida               | Implementado; smoke `anonymous-access-smoke.test.ts` listo contra Supabase de pruebas    |
| 3   | Endpoint directo: tenant ajeno → 403, anónimo → 401                  | Implementado; smoke `anonymous-access-smoke.test.ts` + `tenant-rls.test.ts` listos       |
| 4   | Listado con URL, loader, pending/error, reintento, invalidación      | Hecho: estados de root + invalidación en sitio (`useLoaderReload`) en todas las rutas    |
| 5   | Emisión concurrente idempotente sin números duplicados               | Implementado; smoke `invoice-concurrency-smoke.test.ts` listo contra Supabase de pruebas |
| 6   | PDF privado; descarga cruzada denegada; fiscalidad fuera del cliente | Implementado; smoke `invoice-documents-smoke.test.ts` listo contra Supabase de pruebas   |
| 7   | Integración fiscal en `mock`/`test` y compatibilidad del runtime     | Pendiente: requiere runtime real y certificado, fuera del MVP                            |

## Checklist previa a VERI\*FACTU `prod` (ADR-0005)

Todo pendiente. Ningún tenant puede activar `prod` hasta cerrarla completa y
hasta que un asesor fiscal valide el reparto de responsabilidad.

## Desviaciones conocidas

| Tema                                                            | Situación                                 | Plan                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doscientos-structure` y sufijos `.server.ts` / `.functions.ts` | El checker inspeccionado no los reconoce  | Documentar la excepción concreta y proponer regresión en `@doscientos/configs`. No desactivar el check ni renombrar archivos                                                                                                                                                    |
| Generador `create-operational-app`                              | Solo produce Vite/Router, no Start        | Esqueleto construido a mano con los mismos scripts y contratos de calidad                                                                                                                                                                                                       |
| Proyecto Supabase                                               | Creado; migraciones 0001–0022 aplicadas   | Advisors revisados tras RLS y billing; índices/FKs y denegaciones explícitas incorporados. Persisten sólo los avisos intencionados documentados abajo.                                                                                                                          |
| Helpers `SECURITY DEFINER` visibles para `authenticated`        | Advisor los marca como WARN               | Es intencionado: `is_member_of`, `has_tenant_role`, `is_platform_*` y `reserve_invoice_number` deben ser invocables para que las políticas RLS funcionen. Solo devuelven booleanos o reservan número validando rol                                                              |
| `tenant_public_by_slug` visible para `anon`                     | Advisor lo marca como WARN                | Es intencionado: la resolución de `/t/:slug` ocurre antes de haber sesión. Exige el slug exacto y devuelve solo marca (nombre, estado, idioma, zona horaria), así que no permite enumerar tenants                                                                               |
| Redsys recurrente                                               | Adaptador pendiente de terminal propio    | El esquema guarda sólo referencias cifradas e intentos idempotentes. Antes de activar cobros se debe confirmar MIT/tokenización y configurar secretos exclusivos de SobreTaula.                                                                                                 |
| Facturas SaaS y VERI*FACTU de plataforma                        | Cierre mensual automático y outbox listos | El cron autenticado llama diariamente a la conciliación: genera una vez el último mes cerrado y suspende impagos. Las facturas quedan `pending_review` si falta emisor; el envío certificado que cambia `issued` a `registered` requiere el adaptador VERI*FACTU de plataforma. |

## Comandos de validación

`pnpm format:check`, `pnpm lint`, `pnpm structure:check`, `pnpm typecheck`,
`pnpm test`, `pnpm quality`, `pnpm build`.

Desde F1 se añaden pruebas de RLS y concurrencia contra una base Supabase de
pruebas. Nunca contra producción. Ningún smoke test emite facturas reales.

La integración de RLS (`tenant-rls.test.ts`) se activa únicamente
con `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY` y
`SUPABASE_TEST_SECRET_KEY`. El fichero `.env.test.example` documenta el
contrato y evita ejecutar escrituras de fixtures contra otro entorno.
