# Estado de implementación

Última actualización: 2026-09-10. Incluye la ejecución local de controles de
calidad de esta fecha.

El plan maestro de producto y UX del diseñador/operación de sala vive en
[`room-planner-master-plan.md`](./room-planner-master-plan.md). Su primera
entrega activa es ampliar el plano existente con pisos, zonas y tipos de
espacio sin romper las versiones ya publicadas.

Registro honesto de lo que existe y está verificado. Un punto sin ejecutar es
**pendiente**, no aprobado. No se marca nada como hecho sin evidencia
reproducible (comando ejecutado y su resultado).

## Fases

| Fase                   | Entregable                                                                  | Estado                                                           |
| ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| F0 · Papeleo           | `project-design.md`, `data-model.md`, ADR 0001–0007                         | Hecho                                                            |
| F0 · Esqueleto         | Proyecto Start, `@doscientos/configs`, CI, `.env.example`                   | Hecho                                                            |
| F1 · Tenancy + Auth    | Registro, onboarding, perfiles, equipo, RLS, `/t/:slug`                     | Implementado; RLS real sin evidenciar                            |
| F1a · Gobierno global  | Dashboard, tenants, auditoría, operadores y controles de acceso             | Implementado; falta evidencia RLS dedicada                       |
| F1b · Billing SaaS     | Precios, Founders, cobro Redsys, gracia, facturas SaaS y suspensión segura  | Parcial                                                          |
| F2 · Diseñador de sala | Editor SVG, snap, historial, elementos, rotación real y layouts versionados | Implementado; entrega bloqueada                                  |
| F3 · Motor de reservas | Turnos, pacing, disponibilidad, best-fit, EXCLUDE                           | Implementado; falta aplicar migraciones públicas y humo dedicado |
| F4 · Vista de servicio | Plano en vivo, sentar/mover/unir, walk-ins, espera, no-show                 | Implementado; entrega bloqueada                                  |
| F5 · Cuenta de mesa    | Catálogo, líneas, dividir, cerrar, cobrar                                   | Implementado; entrega bloqueada                                  |
| F6 · Facturación       | Ajustes fiscales, series, ledger/outbox, PDF, modo test                     | Implementado; entrega bloqueada                                  |
| F7 · Entrega           | Documentación operativa, smoke, despliegue autorizado                       | Parcial                                                          |

El dashboard operativo ya calcula reservas activas, reservas de la semana,
sesiones abiertas y cobros del día desde Supabase; la actividad detallada sigue consultándose en las vistas
de Servicio, Reservas y Cuenta. Falta añadir pruebas de integración contra un
proyecto Supabase dedicado.

La operación de sala permite marcar una reserva como `no_show` desde la puerta,
libera su mesa mediante el trigger de sincronización y aplica también en servidor
la espera mínima de 15 minutos para evitar ausencias prematuras.

Las acciones de sentar una reserva, abrir un walk-in y sentar una espera soportan
ahora modo offline: guardan una operación local, la reintentan al recuperar la
conexión y envían un `operation_id` único. La restricción parcial
`table_sessions_operation_id_idx` y las comprobaciones previas hacen que los
reintentos sean idempotentes y no abran una segunda sesión. Movimientos, uniones,
cancelaciones y altas/bajas de espera siguen bloqueados sin red hasta añadir su
propia clave de idempotencia.

Las migraciones de reservas públicas (`20260910000024`, `20260910000025` y
`20260910000026`) están preparadas y revisadas localmente, pero deben aplicarse
de forma explícita en el proyecto Supabase conectado antes de validar el flujo
completo con datos reales.

«Implementado» indica que existe código y pruebas unitarias; no equivale a
entregable aprobado mientras falten pruebas contra un entorno dedicado.

El alcance ampliado solicitado para reservas —agenda, web pública, excepciones,
autogestión, avisos, cliente, espera y grupos— está documentado, pero pendiente de
ejecución, en [`reservations-completion-plan.md`](./reservations-completion-plan.md).

## Puerta de adopción de TanStack Start (ADR-0001)

| #   | Evidencia                                                            | Estado                                                                |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Instalación limpia, tipos, lint, tests y build del artefacto Node    | Correcto localmente; falta una instalación limpia reproducible en CI  |
| 2   | Login/logout/expiración y refresh sin caché compartida               | Implementado; falta evidencia reproducible contra un entorno dedicado |
| 3   | Endpoint directo: tenant ajeno → 403, anónimo → 401                  | Implementado; falta humo dedicado contra base de pruebas              |
| 4   | Listado con URL, loader, pending/error, reintento, invalidación      | Implementado; falta humo dedicado contra base de pruebas              |
| 5   | Emisión concurrente idempotente sin números duplicados               | Implementado en SQL; falta prueba concurrente contra base de pruebas  |
| 6   | PDF privado; descarga cruzada denegada; fiscalidad fuera del cliente | Implementado; falta prueba de descarga cruzada contra base de pruebas |
| 7   | Integración fiscal en `mock`/`test` y compatibilidad del runtime     | Pendiente: requiere runtime real y certificado, fuera del MVP         |

## Checklist previa a VERI\*FACTU `prod` (ADR-0005)

Todo pendiente. Ningún tenant puede activar `prod` hasta cerrarla completa y
hasta que un asesor fiscal valide el reparto de responsabilidad.

## Desviaciones conocidas

| Tema                                                            | Situación                                     | Plan                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doscientos-structure` y sufijos `.server.ts` / `.functions.ts` | El checker inspeccionado no los reconoce      | Documentar la excepción concreta y proponer regresión en `@doscientos/configs`. No desactivar el check ni renombrar archivos                                                                                                                                                    |
| Generador `create-operational-app`                              | Solo produce Vite/Router, no Start            | Esqueleto construido a mano con los mismos scripts y contratos de calidad                                                                                                                                                                                                       |
| Proyecto Supabase                                               | Gobierno global y reservas públicas aplicados | Las migraciones propias aplicadas en producción se han comprobado. Las nuevas migraciones se revisan y aplican individualmente, nunca junto a cambios locales ajenos.                                                                                                           |
| Helpers `SECURITY DEFINER` visibles para `authenticated`        | Advisor los marca como WARN                   | Es intencionado: `is_member_of`, `has_tenant_role`, `is_platform_*` y `reserve_invoice_number` deben ser invocables para que las políticas RLS funcionen. Solo devuelven booleanos o reservan número validando rol                                                              |
| `tenant_public_by_slug` visible para `anon`                     | Advisor lo marca como WARN                    | Es intencionado: la resolución de `/t/:slug` ocurre antes de haber sesión. Exige el slug exacto y devuelve solo marca (nombre, estado, idioma, zona horaria), así que no permite enumerar tenants                                                                               |
| Redsys recurrente                                               | Adaptador pendiente de terminal propio        | El esquema guarda sólo referencias cifradas e intentos idempotentes. Antes de activar cobros se debe confirmar MIT/tokenización y configurar secretos exclusivos de SobreTaula.                                                                                                 |
| Facturas SaaS y VERI*FACTU de plataforma                        | Cierre mensual automático y outbox listos     | El cron autenticado llama diariamente a la conciliación: genera una vez el último mes cerrado y suspende impagos. Las facturas quedan `pending_review` si falta emisor; el envío certificado que cambia `issued` a `registered` requiere el adaptador VERI*FACTU de plataforma. |
| Componentes de `@doscientos/ui`                                 | Usos incompatibles corregidos                 | Se eliminaron props no soportadas de los consumidores (`variant`, `width`, `density`, `icon`); `typecheck`, `quality` y `build` vuelven a completar correctamente.                                                                                                              |

## Comandos de validación

`pnpm format:check`, `pnpm lint`, `pnpm structure:check`, `pnpm typecheck`,
`pnpm test`, `pnpm quality`, `pnpm build`.

### Última ejecución local (2026-09-10)

Tras añadir la validación geométrica de la huella rotada de mesas, la suite
local queda en 47 archivos correctos y 204 pruebas correctas; 1 archivo y 3
pruebas RLS siguen omitidos por falta de entorno Supabase dedicado.

La verificación posterior de producción (`pnpm build`) también completa
correctamente y genera el artefacto Nitro/Vercel. La suite global actual queda
en 48 archivos y 207 pruebas correctas; las 3 RLS continúan omitidas por el
conector no autorizado.

| Comando                | Resultado                                                                 |
| ---------------------- | ------------------------------------------------------------------------- |
| `pnpm format:check`    | Pendiente por 5 archivos ajenos al alcance actual                         |
| `pnpm lint`            | Correcto                                                                  |
| `pnpm structure:check` | Pendiente por 2 nombres `.server*` heredados y `abstract-restaurant.avif` |
| `pnpm test`            | 38 archivos y 177 pruebas correctas; 1 archivo y 3 pruebas RLS omitidas   |
| `pnpm typecheck`       | Correcto                                                                  |
| `pnpm quality`         | Correcto                                                                  |
| `pnpm build`           | Correcto; solo avisos de Vite/chunks                                      |

Las pruebas de integración de RLS (`tenant-rls.test.ts`) requieren un proyecto
Supabase de pruebas dedicado (`SUPABASE_TEST_URL`,
`SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY`; contrato en
`.env.test.example`). Hoy existe un único proyecto Supabase, que es producción:
no hay base de pruebas, así que la suite queda saltada y **no se ejecuta ningún
humo contra producción**. Además del aislamiento entre tenants, la suite cubre
la lectura de auditoría: sólo un `platform_owner` puede consultar
`platform_audit_log`. Cuando exista un proyecto de pruebas, se activan sin
cambios de código y la puerta de adopción (#2, #3, #5, #6) se cierra con esa
evidencia.

### Últimos avances del editor de sala

- Navegación del lienzo con zoom, pan y restablecimiento completo de vista.
- Cuadrícula configurable, snap por bordes/centros y guías de alineación.
- Selección múltiple con Ctrl/Cmd y limpieza con Escape.
- Validación visual de mesas que bloquean puertas o salidas, cubierta con
  pruebas de dominio.
