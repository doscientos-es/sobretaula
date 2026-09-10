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

| Fase                   | Entregable                                                                  | Estado                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F0 · Papeleo           | `project-design.md`, `data-model.md`, ADR 0001–0007                         | Hecho                                                                                                                                                                                                        |
| F0 · Esqueleto         | Proyecto Start, `@doscientos/configs`, CI, `.env.example`                   | Hecho                                                                                                                                                                                                        |
| F1 · Tenancy + Auth    | Registro, onboarding, perfiles, equipo, RLS, `/t/:slug`                     | Implementado; RLS real sin evidenciar                                                                                                                                                                        |
| F1a · Gobierno global  | Dashboard, tenants, auditoría, operadores y controles de acceso             | Implementado; falta evidencia RLS dedicada                                                                                                                                                                   |
| F1b · Billing SaaS     | Precios, Founders, cobro Redsys, gracia, facturas SaaS y suspensión segura  | Parcial                                                                                                                                                                                                      |
| F2 · Diseñador de sala | Editor SVG, snap, historial, elementos, rotación real y layouts versionados | Implementado; entrega bloqueada                                                                                                                                                                              |
| F3 · Motor de reservas | Turnos, pacing, disponibilidad, best-fit, EXCLUDE                           | Implementado; las RPC públicas están activas; falta humo dedicado                                                                                                                                            |
| F4 · Vista de servicio | Plano en vivo, sentar/mover/unir, walk-ins, espera, no-show                 | Implementado; entrega bloqueada                                                                                                                                                                              |
| F5 · Cuenta de mesa    | Catálogo, líneas, dividir, cerrar, cobrar                                   | Implementado; las comandas son reintentables y las anulaciones quedan auditadas; entrega bloqueada                                                                                                           |
| F6 · Facturación       | Ajustes fiscales, series, ledger/outbox, PDF, modo test                     | Implementado; entrega bloqueada                                                                                                                                                                              |
| F7 · TPV ampliado      | Catálogo, comandas, cocina/barra, cobros, caja y arqueo                     | Parcial; el TPV integra cuenta, comandas, cocina/barra, cobro manual, caja e informe diario con permisos; faltan hardware e informe financiero completo                                                      |
| F8 · Reservas públicas | Reserva sin cuenta, gestión, avisos, espera y ficha de cliente              | Parcial; reserva, disponibilidad, gestión por token y confirmación por email activas; faltan recordatorios, espera futura y privacidad avanzada                                                              |
| F9 · Control horario   | PIN, pausas, jornadas, auditoría y exportación                              | Parcial; portal personal, terminal compartido, PIN bcrypt, límite de intentos, eventos inmutables con encadenado y exportación CSV implementados; faltan reglas laborales españolas y su cálculo/explotación |
| F10 · Producto         | Inventario, escandallos, alérgenos, precios por canal y carta               | Parcial; ingredientes, recetas, escandallo, inventario, UI, canales y carta pública enriquecida implementados; faltan versionado y validación visual final                                                   |
| F11 · Entrega          | Documentación operativa, smoke, despliegue autorizado                       | Parcial                                                                                                                                                                                                      |

El dashboard operativo ya calcula reservas activas, reservas de la semana,
sesiones abiertas y cobros del día desde Supabase; la actividad detallada sigue
consultándose en las vistas de Servicio, Reservas y Cuenta. No se ejecutan
pruebas de integración con fixtures: el producto usa un único Supabase con datos
reales.

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

Las migraciones de reservas públicas están activas en el proyecto existente. El
flujo usa RPC anónimas mínimas, no políticas RLS generales sobre reservas o
clientes, y no se han ejecutado fixtures, cargas ni humo sobre datos reales.

### Fichaje seguro por terminal (D4)

El portal personal permite consultar la jornada, fichar y crear o renovar un
PIN numérico de 4 a 8 cifras. El TPV enlaza la nueva terminal compartida en
`/t/:slug/l/:venue/fichaje-terminal`: lista solo al equipo que puede operar en
ese local, no retiene el PIN en navegador y registra entrada, pausa y salida.

Las migraciones locales `20260910000083_timekeeping_terminal_security.sql` y
`20260910000084_timekeeping_pin_attempt_security.sql` fueron aplicadas y
verificadas en el único proyecto autorizado como
`timekeeping_terminal_security` (versión `20260910212711`) y
`timekeeping_pin_attempt_security` (versión `20260910213259`). Los PIN nuevos
usan bcrypt; los hashes SHA-256 heredados se reemplazan por bcrypt al primer uso
correcto. Tras cinco PIN erróneos, se bloquean durante 15 minutos tanto el
terminal como el empleado/local, evitando eludir el límite rotando un
identificador de navegador. Los eventos no admiten escritura directa,
modificación ni borrado: solo las RPC atómicas con comprobación de tenant, local
y asignación de empleado pueden crearlos, y cada evento nuevo referencia el hash
del anterior. RLS permanece forzado y el trigger append-only y ambos RPC
`SECURITY DEFINER` fueron comprobados por metadatos; no se crearon ni consultaron
datos operativos.

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
entregable aprobado mientras falte evidencia operativa reproducible.

El alcance ampliado solicitado para reservas —agenda, web pública, excepciones,
autogestión, avisos, cliente, espera y grupos— está documentado, pero pendiente de
ejecución, en [`reservations-completion-plan.md`](./reservations-completion-plan.md).

## Puerta de adopción de TanStack Start (ADR-0001)

| #   | Evidencia                                                            | Estado                                                                       |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Instalación limpia, tipos, lint, tests y build del artefacto Node    | Correcto localmente; falta una instalación limpia reproducible en CI         |
| 2   | Login/logout/expiración y refresh sin caché compartida               | Implementado; falta evidencia operativa reproducible                         |
| 3   | Endpoint directo: tenant ajeno → 403, anónimo → 401                  | Implementado; falta evidencia operativa sin datos reales                     |
| 4   | Listado con URL, loader, pending/error, reintento, invalidación      | Implementado; falta evidencia operativa sin datos reales                     |
| 5   | Emisión concurrente idempotente sin números duplicados               | Implementado en SQL; no se ejecutan carreras contra datos reales             |
| 6   | PDF privado; descarga cruzada denegada; fiscalidad fuera del cliente | Implementado; falta evidencia de acceso controlado                           |
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

La última ejecución de `pnpm quality` completa correctamente con 75 archivos y
293 pruebas correctas. Un archivo y tres pruebas RLS siguen omitidos de forma
deliberada para no conectarlos al proyecto con datos reales.

| Comando                | Resultado                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm format:check`    | Correcto                                                                                     |
| `pnpm lint`            | Correcto                                                                                     |
| `pnpm structure:check` | Correcto localmente; el asset de login vive en `public/` y los módulos usan nombres estándar |
| `pnpm test`            | 75 archivos y 293 pruebas correctas; 1 archivo y 3 pruebas RLS omitidas deliberadamente      |
| `pnpm typecheck`       | Correcto                                                                                     |
| `pnpm quality`         | Correcto                                                                                     |
| `pnpm build`           | Correcto; solo avisos de Vite/chunks                                                         |

Las pruebas de integración de RLS (`tenant-rls.test.ts`) permanecen omitidas:
el producto usa un único proyecto Supabase con datos reales y no se permite
conectarlas, crear fixtures ni ejecutar humo, cargas o carreras sobre él.
Además del aislamiento entre tenants, la suite cubre la lectura de auditoría:
sólo un `platform_owner` puede consultar `platform_audit_log`. La evidencia de
este control se limita hasta nuevo acuerdo a revisión de esquema y pruebas
unitarias, sin presentar esa limitación como validación de producción.

### Despliegue revisado en Supabase existente (2026-09-10)

Se identificó el único proyecto autorizado de SobreTaula y se comparó su
historial con `supabase/migrations`. Tras revisar el SQL individualmente, se
aplicaron las piezas pendientes de compatibilidad de membresía, estados de
línea, caja, ingredientes/recetas, inventario, precios por canal, carta pública,
fichaje/PIN, devoluciones, descuentos, resumen de caja, alérgenos y versiones de
receta. La función de carta pública se desplegó después de la tabla de precios
por canal, su dependencia real. Posteriormente se desplegaron las migraciones
de cuenta idempotente y auditoría inmutable de anulaciones (`80` y `81`), y la
de reserva pública con comentario, constancia de privacidad y correo exclusivo
(`82`). No se usaron fixtures ni se ejecutaron pruebas de carga, concurrencia o
humo contra datos de producción.

### Primer módulo TPV unificado (D1)

La ruta `/t/:slug/l/:venue/tpv` es ahora la entrada predeterminada de cada
local. Reutiliza el tablero de servicio autorizado para presentar el estado de
mesas, cuentas abiertas y cocina sin crear una segunda fuente de verdad, y
conserva el acceso compatible a sala, reservas, caja y cuentas existentes. La
integración embebida de comanda, cobro y cocina queda como siguientes entregas
del módulo. El resumen operativo tiene prueba unitaria; `typecheck` y la
compilación de Vite terminaron correctamente.

### Cuenta y comandas dentro del TPV (D2)

El TPV permite abrir una cuenta por mesa mediante `sessionId` en su propia URL,
tomar comandas con notas y volver al selector sin abandonar el módulo. El alta
de cada comanda usa una clave idempotente: sin conexión se guarda localmente y
se reintenta al recuperar la red; anulaciones y cobros no se encolan porque
requieren contrastar el estado actual de la cuenta.

Las anulaciones ya no eliminan líneas. Se conserva la línea con estado
`cancelled`, se excluye de los totales y se registra el motivo, usuario, local y
fecha en `order_item_cancellations`; el inventario se revierte como movimiento
separado. Camareros pueden anular líneas no servidas y responsables también las
servidas, siempre antes de registrar cobros. Las migraciones
`20260910000080_idempotent_order_cancellations.sql` y
`20260910000081_order_item_cancellation_audit_immutable.sql` están aplicadas en
el proyecto existente: la auditoría sólo permite lectura e inserción mediante
RLS, por lo que sus eventos son inmutables.

### Cocina, cobros, caja e informes dentro del TPV (D3)

La misma ruta TPV incorpora la cola de cocina y barra con avance controlado de
estado, prevención de doble pulsación y feedback de fallo. El cobro es manual:
el personal confirma antes la tarjeta en el datáfono y sólo después la registra,
por lo que no se encola cuando no hay red. Camareros pueden cobrar y operar
comandas, pero descuentos y devoluciones sólo se muestran a responsables y las
acciones de servidor mantienen esa autorización.

Los responsables ven además apertura, entradas y salidas de efectivo, desglose
por método, arqueo e histórico de cierres, junto con el informe de ventas y el
resumen de productos. Todos estos datos reutilizan los contratos existentes de
caja, informes y servicio; no hay una segunda fuente de verdad. Se han validado
el ensamblaje con TypeScript y 21 pruebas unitarias de cuenta, TPV, caja e
informes. La integración física de datáfonos y el informe financiero/contable
completo siguen fuera del alcance actual.

### Refuerzo de reserva pública por email (en validación)

La reserva web exige ahora email y aceptación de la política de privacidad; el
teléfono queda opcional y se puede incluir un comentario de hasta 1.000
caracteres para el restaurante. La nueva RPC
`create_public_reservation_with_details` conserva las RPC públicas anteriores,
registra la aceptación en la reserva y aplica el comentario dentro de la misma
transacción. El trigger de confirmación encola solo correo para las nuevas
reservas, conforme a la decisión de no activar SMS ni WhatsApp.

La migración `20260910000082_public_reservation_consent_and_notes.sql` está
aplicada en el único proyecto autorizado. Se comprobó por metadatos antes del
cambio que no existían esos campos y que permanecen disponibles las firmas
anteriores, pero la validación local de TypeScript, pruebas y permisos de la
nueva función fue interrumpida antes de completarse; por ello esta entrega aún
no se marca como cerrada.

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
