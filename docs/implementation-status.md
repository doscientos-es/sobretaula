# Estado de implementación

Última actualización: 2026-09-10. Incluye la ejecución local de controles de
calidad de esta fecha.

El plan maestro de producto y UX del diseñador/operación de sala vive en
[`room-planner-master-plan.md`](./room-planner-master-plan.md). Su primera
entrega activa es ampliar el plano existente con pisos, zonas y tipos de
espacio sin romper las versiones ya publicadas.

La comparación contra la petición original del cliente vive en
[`client-mvp-gap-analysis.md`](./client-mvp-gap-analysis.md). Ese documento
separa hecho, a medias, pendiente y bloqueado; no debe inferirse que una fase
interna marcada como «implementada» cubre todo el MVP comercial.

Registro honesto de lo que existe y está verificado. Un punto sin ejecutar es
**pendiente**, no aprobado. No se marca nada como hecho sin evidencia
reproducible (comando ejecutado y su resultado).

## Fases

| Fase                   | Entregable                                                                  | Estado                                                                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0 · Papeleo           | `project-design.md`, `data-model.md`, ADR 0001–0007                         | Hecho                                                                                                                                                                                                                                                                        |
| F0 · Esqueleto         | Proyecto Start, `@doscientos/configs`, CI, `.env.example`                   | Hecho                                                                                                                                                                                                                                                                        |
| F1 · Tenancy + Auth    | Registro, onboarding, perfiles, equipo, RLS, `/t/:slug`                     | Implementado; RLS real sin evidenciar                                                                                                                                                                                                                                        |
| F1a · Gobierno global  | Dashboard, tenants, auditoría, operadores y controles de acceso             | Implementado; falta evidencia RLS dedicada                                                                                                                                                                                                                                   |
| F1b · Billing SaaS     | Precios, Founders, cobro Redsys, gracia, facturas SaaS y suspensión segura  | Parcial                                                                                                                                                                                                                                                                      |
| F2 · Diseñador de sala | Editor SVG, snap, historial, elementos, rotación real y layouts versionados | Implementado; entrega bloqueada                                                                                                                                                                                                                                              |
| F3 · Motor de reservas | Turnos, pacing, disponibilidad, best-fit, EXCLUDE                           | Implementado; falta aplicar migraciones públicas y humo dedicado                                                                                                                                                                                                             |
| F4 · Vista de servicio | Plano en vivo, sentar/mover/unir, walk-ins, espera, no-show                 | Implementado; entrega bloqueada                                                                                                                                                                                                                                              |
| F5 · Cuenta de mesa    | Catálogo, líneas, dividir, cerrar, cobrar                                   | Implementado; entrega bloqueada                                                                                                                                                                                                                                              |
| F6 · Facturación       | Ajustes fiscales, series, ledger/outbox, PDF, modo test                     | Implementado; entrega bloqueada                                                                                                                                                                                                                                              |
| F7 · TPV ampliado      | Catálogo, comandas, cocina/barra, cobros, caja y arqueo                     | Parcial; cuenta, catálogo, estaciones, estados, cola, devoluciones, descuentos, caja, histórico, UI/informe y exportación CSV inicial implementados; faltan hardware e informe financiero completo                                                                           |
| F8 · Reservas públicas | Reserva sin cuenta, gestión, avisos, espera y ficha de cliente              | Parcial; motor interno existe, falta cierre del flujo público                                                                                                                                                                                                                |
| F9 · Control horario   | PIN, pausas, jornadas, auditoría y exportación                              | Parcial; eventos, transiciones, cálculo, pantalla inicial, exportación CSV, PIN almacenado como hash y endpoint de terminal para verificar PIN y registrar el evento del empleado implementados; faltan UX de terminal compartido, limitación de intentos y reglas laborales |
| F10 · Producto         | Inventario, escandallos, alérgenos, precios por canal y carta               | Parcial; ingredientes, recetas, escandallo, inventario, UI, canales y carta pública enriquecida implementados; faltan versionado y validación visual final                                                                                                                   |
| F11 · Entrega          | Documentación operativa, smoke, despliegue autorizado                       | Parcial                                                                                                                                                                                                                                                                      |

El dashboard operativo ya calcula reservas activas, reservas de la semana,
sesiones abiertas y cobros del día desde Supabase; la actividad detallada sigue consultándose en las vistas
de Servicio, Reservas y Cuenta. Falta añadir pruebas de integración contra un
proyecto Supabase dedicado.

La operación de sala permite marcar una reserva como `no_show` desde la puerta,
libera su mesa mediante el trigger de sincronización y aplica también en servidor
la espera mínima de 15 minutos para evitar ausencias prematuras.

La vista de servicio permite guardar una nota interna de hasta 500 caracteres en
cada sesión abierta para handover y contexto operativo. La migración
`20260910000046_service_session_notes.sql` debe aplicarse en Supabase antes de
usar esta capacidad en el entorno conectado.

El modelo operativo soporta mesas bloqueadas con motivo y las excluye del
cálculo de mesas libres y sugerencias. La vista de servicio permite bloquear y
reabrir la selección; el servidor rechaza bloquear mesas con sesiones abiertas.
Requiere aplicar `20260910000047_service_table_blocks.sql`.

Al cerrar una cuenta, sus mesas pasan a `Pendiente de limpiar` y dejan de ser
seleccionables hasta que el equipo las marca como limpias. La capacidad se
persiste en `20260910000048_service_table_cleaning.sql`.

El realtime de servicio escucha ahora `table_sessions` y `tables` además de
reservas y asignaciones, por lo que bloqueos, limpieza y cierres actualizan el
panel sin recarga manual.

Las áreas ya admiten asignación de uno o varios miembros activos del equipo
(owner, manager, host o waiter) desde Servicio. La relación se guarda con RLS
en `area_staff_assignments` (`20260910000049_area_staff_assignments.sql`).
Si esa migración aún no está aplicada, Servicio continúa mostrando el tablero
sin asignaciones y permite operar las mesas normalmente.

El panel muestra un cronómetro de cada cuenta abierta y marca el estado de
pacing cuando supera los 90 minutos (umbral configurable en el dominio). La
medición es pura y usa el reloj compartido de la vista para refrescarse.

Servicio incluye también un handover vivo por área con equipo asignado, cuentas
abiertas, mesas por limpiar, bloqueos y sesiones que requieren atención.

El responsable puede guardar esa fotografía como entrega inmutable en
`service_handover_snapshots`, con usuario y fecha (`20260910000050_service_handover_snapshots.sql`).
Servicio carga y muestra las diez últimas entregas del local para consultar el
histórico sin salir de la operativa. Se cargan las últimas 50 entregas; cada una
se puede expandir por sección
para revisar la fotografía completa del turno y compara sus cifras con el
estado vivo actual, señalando cambios por área.
El guardado muestra estado de progreso y error recuperable cuando la red falla.
La lectura es compatible con despliegues que aún no han aplicado la migración:
si la tabla no existe, el servicio continúa operativo y oculta temporalmente el
histórico.
La comparación también conserva áreas que han desaparecido del tablero actual,
para hacer visible una sección retirada o desactivada desde la última entrega.
El historial admite filtrar las últimas entregas por fecha desde la propia vista.

Las acciones de sentar una reserva, abrir un walk-in y sentar una espera soportan
ahora modo offline: guardan una operación local, la reintentan al recuperar la
conexión y envían un `operation_id` único. La restricción parcial
`table_sessions_operation_id_idx` y las comprobaciones previas hacen que los
reintentos sean idempotentes y no abran una segunda sesión. Movimientos, uniones,
cancelaciones y no-shows también se encolan sin red, con una marca idempotente
en la reserva (`reservations.last_operation_id`). Mover, unir y cerrar aceptan
`operation_id`, guardan la última operación aplicada y ya están conectados al
mismo encolado del navegador; quitar entradas de espera también se encola sin
red (la operación es idempotente por diseño). Añadir nuevas entradas offline
también queda cubierto con una operación idempotente y la migración propia de
`waitlist.operation_id`; al reconectar se recrea el invitado si hace falta.

Las migraciones de reservas públicas (`20260910000024`, `20260910000025` y
`20260910000026`) están preparadas y revisadas localmente, pero deben aplicarse
de forma explícita en el proyecto Supabase conectado antes de validar el flujo
completo con datos reales.

La política de terraza ya está aislada en dominio (`weather-policy.ts`): permite
decidir de forma determinista si mantener el exterior, trasladar al interior o
pedir revisión por calor. También calcula un plan de traslado por capacidad y
ocupación, dejando explícitamente las reservas sin hueco. La integración con
proveedor meteorológico ya tiene un contrato y normalizador aislados en
`application/weather-provider.ts`; el adaptador HTTP ya está implementado y la
aplicación transaccional del plan ya rechaza
planes con reservas sin capacidad y exige que la transacción confirme todos
los movimientos. El caso de uso ya devuelve una decisión de
negocio (`keep_outdoor`, `review` o `move_inside`) sin filtrar detalles del
proveedor a la UI.

El plano también puede exportarse/importarse como plantilla JSON versionada y
portable: excluye ids internos de venue y versión, valida formato y versión
antes de entrar en la capa de aplicación, y deja la extracción desde imagen o
PDF para una entrega posterior.

Las plantillas de evento ya tienen un contrato de dominio reutilizable sobre
esas plantillas de plano, con vigencia, áreas afectadas y detección de solapes;
la persistencia Supabase/RLS y el schema de aplicación ya están preparados;
el CRUD server completo de listado, creación, edición y borrado ya está
preparado y el editor permite crear, editar y borrar plantillas desde el layout
actual.
El loader degrada a una lista vacía si la migración aún no está aplicada, para
que el plano existente no quede bloqueado durante el despliegue progresivo.

«Implementado» indica que existe código y pruebas unitarias; no equivale a
entregable aprobado mientras falten pruebas contra un entorno dedicado.

El alcance ampliado solicitado para reservas —agenda, web pública, excepciones,
autogestión, avisos, cliente, espera y grupos— está documentado, pero pendiente de
ejecución, en [`reservations-completion-plan.md`](./reservations-completion-plan.md).

## Puerta de adopción de TanStack Start (ADR-0001)

| #   | Evidencia                                                            | Estado                                                                       |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Instalación limpia, tipos, lint, tests y build del artefacto Node    | Correcto localmente; falta una instalación limpia reproducible en CI         |
| 2   | Login/logout/expiración y refresh sin caché compartida               | Implementado; falta evidencia reproducible contra un entorno dedicado        |
| 3   | Endpoint directo: tenant ajeno → 403, anónimo → 401                  | Implementado; falta humo dedicado contra base de pruebas                     |
| 4   | Listado con URL, loader, pending/error, reintento, invalidación      | Implementado; falta humo dedicado contra base de pruebas                     |
| 5   | Emisión concurrente idempotente sin números duplicados               | Implementado en SQL; falta prueba concurrente contra base de pruebas         |
| 6   | PDF privado; descarga cruzada denegada; fiscalidad fuera del cliente | Implementado; falta prueba de descarga cruzada contra base de pruebas        |
| 7   | Integración fiscal en `mock`/`test` y compatibilidad del runtime     | Pendiente: requiere runtime real y certificado; forma parte del MVP ampliado |

## Checklist previa a VERI\*FACTU `prod` (ADR-0005)

Todo pendiente. Ningún tenant puede activar `prod` hasta cerrarla completa y
hasta que un asesor fiscal valide el reparto de responsabilidad.

## Desviaciones conocidas

| Tema                                                            | Situación                                          | Plan                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doscientos-structure` y sufijos `.server.ts` / `.functions.ts` | El checker inspeccionado no los reconoce           | Documentar la excepción concreta y proponer regresión en `@doscientos/configs`. No desactivar el check ni renombrar archivos                                                                                                                                                                                         |
| Generador `create-operational-app`                              | Solo produce Vite/Router, no Start                 | Esqueleto construido a mano con los mismos scripts y contratos de calidad                                                                                                                                                                                                                                            |
| Proyecto Supabase                                               | Gobierno global y reservas públicas aplicados      | Las migraciones propias aplicadas en producción se han comprobado. Las nuevas migraciones se revisan y aplican individualmente, nunca junto a cambios locales ajenos.                                                                                                                                                |
| Helpers `SECURITY DEFINER` visibles para `authenticated`        | Advisor los marca como WARN                        | Es intencionado: `is_member_of`, `has_tenant_role`, `is_platform_*` y `reserve_invoice_number` deben ser invocables para que las políticas RLS funcionen. Solo devuelven booleanos o reservan número validando rol                                                                                                   |
| `tenant_public_by_slug` visible para `anon`                     | Advisor lo marca como WARN                         | Es intencionado: la resolución de `/t/:slug` ocurre antes de haber sesión. Exige el slug exacto y devuelve solo marca (nombre, estado, idioma, zona horaria), así que no permite enumerar tenants                                                                                                                    |
| Redsys recurrente                                               | Alta inicial preparada; cobro recurrente pendiente | La alta inicial ya crea factura/intento y genera formulario firmado; el webhook sigue siendo idempotente. La terminal prevista es `999`. Falta confirmar con Redsys la habilitación COF/MIT/tokenización, recibir y cifrar `Ds_Merchant_COF_TXNID`, ejecutar renovaciones mediante REST y conectar el cron de cobro. |
| Facturas SaaS y VERI*FACTU de plataforma                        | Cierre mensual automático y outbox listos          | El cron autenticado llama diariamente a la conciliación: genera una vez el último mes cerrado y suspende impagos. Las facturas quedan `pending_review` si falta emisor; el envío certificado que cambia `issued` a `registered` requiere el adaptador VERI*FACTU de plataforma.                                      |
| Componentes de `@doscientos/ui`                                 | Usos incompatibles corregidos                      | Se eliminaron props no soportadas de los consumidores (`variant`, `width`, `density`, `icon`); `typecheck`, `quality` y `build` vuelven a completar correctamente.                                                                                                                                                   |

## Comandos de validación

`pnpm format:check`, `pnpm lint`, `pnpm structure:check`, `pnpm typecheck`,
`pnpm test`, `pnpm quality`, `pnpm build`.

### Última ejecución local (2026-09-10)

Tras añadir la validación geométrica de la huella rotada de mesas, la suite
local queda en 64 archivos correctos y 272 pruebas correctas; 1 archivo y 3
pruebas RLS siguen omitidos por falta de entorno Supabase dedicado.

La verificación posterior de producción (`pnpm build`) también completa
correctamente y genera el artefacto Nitro/Vercel. La suite global actual queda
en 64 archivos y 272 pruebas correctas; 1 archivo y 3 pruebas RLS continúan
omitidos por el conector no autorizado.

| Comando                | Resultado                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm format:check`    | Pendiente por 5 archivos ajenos al alcance actual                                            |
| `pnpm lint`            | Correcto                                                                                     |
| `pnpm structure:check` | Correcto localmente; el asset de login vive en `public/` y los módulos usan nombres estándar |
| `pnpm test`            | 64 archivos y 272 pruebas correctas; 1 archivo y 3 pruebas RLS omitidas                      |
| `pnpm typecheck`       | Correcto                                                                                     |
| `pnpm quality`         | Correcto                                                                                     |
| `pnpm build`           | Correcto; solo avisos de Vite/chunks                                                         |

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

### Despliegue revisado en Supabase existente (2026-09-10)

Se identificó el único proyecto autorizado de SobreTaula y se comparó su
historial con `supabase/migrations`. Tras revisar el SQL individualmente, se
aplicaron las piezas pendientes de compatibilidad de membresía, estados de
línea, caja, ingredientes/recetas, inventario, precios por canal, carta pública,
fichaje/PIN, devoluciones, descuentos, resumen de caja, alérgenos y versiones de
receta. La función de carta pública se desplegó después de la tabla de precios
por canal, su dependencia real. No se usaron fixtures ni se ejecutaron pruebas
de carga, concurrencia o humo contra datos de producción.

### Primer módulo TPV unificado (D1)

La ruta `/t/:slug/l/:venue/tpv` es ahora la entrada predeterminada de cada
local. Reutiliza el tablero de servicio autorizado para presentar el estado de
mesas, cuentas abiertas y cocina sin crear una segunda fuente de verdad, y
conserva el acceso compatible a sala, reservas, caja y cuentas existentes. La
integración embebida de comanda, cobro y cocina queda como siguientes entregas
del módulo. El resumen operativo tiene prueba unitaria; `typecheck` y la
compilación de Vite terminaron correctamente.

### Últimos avances del editor de sala

- Navegación del lienzo con zoom, pan y restablecimiento completo de vista.
- Cuadrícula configurable, snap por bordes/centros y guías de alineación.
- Selección múltiple con Ctrl/Cmd y limpieza con Escape.
- Validación visual de mesas que bloquean puertas o salidas, cubierta con
  pruebas de dominio.
- Previsualización del lienzo en escritorio, tablet y móvil mediante anchos
  objetivo, sin alterar coordenadas ni datos persistidos.
- Publicación programada con inicio y fin opcional, validación de intervalos y
  protección frente a versiones temporales inválidas.
- Presets de combinaciones: guardar desde selección y reaplicar mesas de una
  zona desde la lista de combinaciones guardadas.
- La sugerencia automática limita ahora la combinación a la zona seleccionada;
  admite además filtrar mesas accesibles; la proximidad de la siguiente reserva
  queda como evolución.
  La lista operativa también muestra la etiqueta `Accesible` para que el equipo
  pueda verificar la selección sin depender solo del filtro.
  El editor de plano permite marcar nuevas mesas como accesibles y persiste esa
  propiedad para el recomendador. Durante un despliegue progresivo, si la columna
  aún no existe, la creación usa el esquema legado sin bloquear el plano.
  El tablero operativo aplica el mismo fallback de lectura y considera las mesas
  existentes como no accesibles hasta completar la migración.
- El editor valida el ancho mínimo de pasillo entre elementos y bloquea la
  publicación cuando detecta pasos inferiores a 75 cm, 90 cm o 1,2 m según la
  configuración elegida.
- Servicio permite separar una selección de mesas en una nueva sesión con
  operación idempotente; rechaza reservas, comandas o pagos ya iniciados para
  no dividir una cuenta sin asignación explícita de sus líneas.
- Las mesas reservadas exponen en la lista accesible si la reserva es inminente,
  cuántos minutos faltan o la hora prevista, para priorizar decisiones del jefe
  de sala sin depender del color del plano.
- El recomendador conserva la siguiente reserva de cada mesa aunque todavía se
  vea libre y evita asignarla dentro del margen de protección configurado;
  si no queda alternativa segura, permite degradar a la mejor opción disponible.
- Cuando se opera sin una zona fija, las combinaciones con igual capacidad
  priorizan la sección con menor carga de sesiones abiertas.
- Las reservas incorporan las notas de cliente clasificadas como `preference`
  y la vista de Servicio las muestra junto a la mesa asignada, dejando una
  base estructurada para ordenar por preferencias sin interpretar texto libre.
- El bloqueo de elementos del editor se persiste ahora en `table_placements`
  al publicar una versión y se recupera en otros dispositivos; mientras la
  migración no exista, el lector y el guardado usan el esquema legado sin
  bloquear el editor.
- La operación de Servicio ya permite asignar trabajadores por sección y
  conserva pacing, cronómetros y handover; quedan fuera de este bloque los
  objetivos configurables por turno y las alertas de carga de cocina.
- El objetivo de pacing del local se guarda en `venues` (15–360 minutos), se
  carga con fallback a 90 minutos durante la migración y se aplica tanto al
  detalle de sesión como al handover.
- Servicio calcula la carga objetiva de cocina con las comandas abiertas de
  los últimos 30 minutos y muestra una alerta cuando supera el umbral del
  local (por defecto, 12); el umbral admite entre 1 y 200 comandas.
- La carta y sus líneas de cuenta conservan una estación (`general`, `hot`,
  `cold`, `bar` o `dessert`), con fallback a `general` durante la migración;
  la cuenta muestra la estación para preparar la futura carga por estación.
- La carga de cocina ya se desglosa por estación usando las cantidades de línea
  de los últimos 30 minutos ponderadas por minutos de preparación y muestra
  avisos independientes cuando una estación supera el umbral configurable del
  local (por defecto, 60 minutos).
- Dirección puede editar los minutos de preparación desde la carta al crear o
  modificar un plato; cada comanda conserva el valor histórico de ese momento.
- Dirección también puede asignar la estación del plato desde la carta; la
  selección se congela en la línea de comanda y admite fallback a `general`.
