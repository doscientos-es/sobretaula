# Estado de implementación

Última actualización: 2026-09-08.

Registro honesto de lo que existe y está verificado. Un punto sin ejecutar es
**pendiente**, no aprobado. No se marca nada como hecho sin evidencia
reproducible (comando ejecutado y su resultado).

## Fases

| Fase                   | Entregable                                                | Estado    |
| ---------------------- | --------------------------------------------------------- | --------- |
| F0 · Papeleo           | `project-design.md`, `data-model.md`, ADR 0001–0007       | Hecho     |
| F0 · Esqueleto         | Proyecto Start, `@doscientos/configs`, CI, `.env.example` | Hecho     |
| F1 · Tenancy + Auth    | Migraciones, RLS, `/t/:slug`, perfiles global y tenant    | Parcial   |
| F2 · Diseñador de sala | Editor SVG, áreas, layouts versionados, vista accesible   | Pendiente |
| F3 · Motor de reservas | Turnos, pacing, disponibilidad, best-fit, EXCLUDE         | Pendiente |
| F4 · Vista de servicio | Plano en vivo, sentar/mover/unir, walk-ins, espera        | Pendiente |
| F5 · Cuenta de mesa    | Catálogo, líneas, dividir, cerrar, cobrar                 | Pendiente |
| F6 · Facturación       | Ajustes fiscales, series, ledger/outbox, PDF, modo test   | Pendiente |
| F7 · Entrega           | Documentación operativa, smoke, despliegue autorizado     | Pendiente |

## Puerta de adopción de TanStack Start (ADR-0001)

| #   | Evidencia                                                            | Estado    |
| --- | -------------------------------------------------------------------- | --------- |
| 1   | Instalación limpia, tipos, lint, tests y build del artefacto Node    | Hecho     |
| 2   | Login/logout/expiración y refresh sin caché compartida               | Pendiente |
| 3   | Endpoint directo: tenant ajeno → 403, anónimo → 401                  | Pendiente |
| 4   | Listado con URL, loader, pending/error, reintento, invalidación      | Pendiente |
| 5   | Emisión concurrente idempotente sin números duplicados               | Pendiente |
| 6   | PDF privado; descarga cruzada denegada; fiscalidad fuera del cliente | Pendiente |
| 7   | Integración fiscal en `mock`/`test` y compatibilidad del runtime     | Pendiente |

## Checklist previa a VERI\*FACTU `prod` (ADR-0005)

Todo pendiente. Ningún tenant puede activar `prod` hasta cerrarla completa y
hasta que un asesor fiscal valide el reparto de responsabilidad.

## Desviaciones conocidas

| Tema                                                            | Situación                                | Plan                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `doscientos-structure` y sufijos `.server.ts` / `.functions.ts` | El checker inspeccionado no los reconoce | Documentar la excepción concreta y proponer regresión en `@doscientos/configs`. No desactivar el check ni renombrar archivos                                                                                       |
| Generador `create-operational-app`                              | Solo produce Vite/Router, no Start       | Esqueleto construido a mano con los mismos scripts y contratos de calidad                                                                                                                                          |
| Proyecto Supabase                                               | Creado; migraciones 0001–0015 aplicadas  | Advisors de seguridad y rendimiento revisados: sin hallazgos accionables pendientes                                                                                                                                |
| Helpers `SECURITY DEFINER` visibles para `authenticated`        | Advisor los marca como WARN              | Es intencionado: `is_member_of`, `has_tenant_role`, `is_platform_*` y `reserve_invoice_number` deben ser invocables para que las políticas RLS funcionen. Solo devuelven booleanos o reservan número validando rol |
| `tenant_public_by_slug` visible para `anon`                     | Advisor lo marca como WARN               | Es intencionado: la resolución de `/t/:slug` ocurre antes de haber sesión. Exige el slug exacto y devuelve solo marca (nombre, estado, idioma, zona horaria), así que no permite enumerar tenants                  |

## Comandos de validación

`pnpm format:check`, `pnpm lint`, `pnpm structure:check`, `pnpm typecheck`,
`pnpm test`, `pnpm quality`, `pnpm build`.

Desde F1 se añaden pruebas de RLS y concurrencia contra una base Supabase de
pruebas. Nunca contra producción. Ningún smoke test emite facturas reales.
