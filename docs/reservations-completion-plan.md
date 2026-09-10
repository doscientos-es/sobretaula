# Plan de finalización del módulo de reservas

Estado: ejecución iterativa. Última revisión: 2026-09-10.

Este es el plan de entregas verificables para completar las capacidades de
reservas solicitadas. No declara ninguna de ellas como terminada.

## 1. Base existente y brechas

| Capacidad       | Existe                                                                                 | Falta para el alcance final                           |
| --------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Turnos y reglas | `services`, `availability_rules`, duración y pacing                                    | Edición, máximo de grupo y regla/horario por área     |
| Disponibilidad  | Cierres, best-fit y `EXCLUDE` de mesas                                                 | Transacción única para crear, editar y cancelar       |
| Reserva interna | Alta con asignación automática, teléfono, deduplicación y agenda por fecha                | Cambio de hora/grupo, detalle e historial              |
| Operación       | Sentar lleva a `seated`; cerrar sesión a `completed`; cancelación y no-show desde sala y agenda | Cambio de hora/grupo, historial y eventos       |
| Clientes        | Nombre, contacto, idioma, notas y alergias                                             | Etiquetas, notas auditadas, deduplicación e historial |
| Espera          | Cola presencial en Servicio con nombre, teléfono y asignación manual                  | Espera de fecha futura, oferta, aviso y caducidad     |
| Cobro           | Sesión enlazada a reserva y pagos                                                      | Condiciones, depósitos, webhook y reembolsos          |

Las piezas base están en `src/features/reservations`, `src/features/service` y
las migraciones `20260908000007`, `00008` y `00016`. La cadena
reserva → sesión → pagos permite obtener visitas y gasto sin duplicar importes.

## 2. Principios no negociables

1. **Hora local.** La agenda y los turnos se expresan en la zona horaria del
   local; Postgres guarda instantes `timestamptz`. Cubrir horario de verano.
2. **Disponibilidad autoritativa.** Una RPC transaccional valida turnos, reglas,
   bloqueos, pacing y mesas, y crea/actualiza asignaciones en la misma operación.
   La restricción `EXCLUDE` queda como defensa ante concurrencia.
3. **Estados trazables.** `pending → confirmed → seated → completed`; cancelar y
   no-show son finales. Cada transición exige actor, fecha y motivo cuando aplique.
4. **Una reserva no es una visita.** Solo la sesión cerrada vinculada acredita una
   visita; el gasto se deriva de sus pagos, nunca de una estimación.
5. **Datos mínimos y privados.** Notas, alergias y incidencias solo son accesibles
   al tenant autorizado. Los enlaces públicos guardan hashes de tokens, caducan y
   no otorgan acceso a la sesión interna.
6. **Mensajes y pagos asíncronos.** Confirmaciones, recordatorios, ofertas y
   depósitos pasan por outboxes idempotentes; ningún proveedor se invoca durante
   una petición de usuario.
7. **No copiar el cobro SaaS.** Los depósitos pertenecen al restaurante, usan un
   proveedor/merchant separado y no almacenan tarjeta, PAN ni CVV.

## Siguiente PR: agenda operativa por fecha

Antes de ampliar horarios, vacaciones o excepciones complejas, la siguiente
entrega debe permitir consultar una fecha concreta desde Reservas: selector de
día en la zona horaria del local, listado ordenado por hora con nombre, teléfono,
comensales, mesa y estado, refresco explícito y cancelación. El loader debe
filtrar en servidor por `venue_id` y rango diario, mantener Servicio como vista
operativa en tiempo real y cubrir con pruebas el aislamiento por tenant, los
límites del rango y la cancelación idempotente. La agenda ya muestra etiquetas
operativas en español y ofrece no-show tras la tolerancia de 15 minutos.

## 3. Decisiones necesarias antes de R1

| Decisión           | Propuesta inicial                                                            | Aprobación             |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------- |
| Confirmación web   | Automática sin depósito; tras pago cuando se exige depósito                  | Producto + operaciones |
| Cambio/cancelación | Hasta antelación configurada, sin sesión abierta ni depósito no reembolsable | Operaciones + legal    |
| No-show            | Tolerancia por local y motivo obligatorio                                    | Operaciones            |
| Lista de espera    | Oferta temporal aceptable desde enlace; nunca reserva automática             | Producto               |
| Etiquetas          | Sistema: VIP, carrito, mascota y cumpleaños; catálogo adicional por tenant   | Operaciones            |
| Depósitos          | Umbral, importe fijo/por persona, vencimiento y reembolso por local          | Operaciones + finanzas |
| Mensajería         | Proveedor, coste, remitente, opt-in y canal primario                         | Producto + legal       |
| Retención          | Consentimiento, exportación, anonimización y retención de datos de cliente   | Legal                  |

## 4. Migraciones y modelo de datos

No se edita una migración aplicada. Cada punto es una migración nueva, pequeña y
probada contra un proyecto de Supabase dedicado.

### R1 · Reglas, áreas y excepciones

1. Extender `availability_rules` con máximo de grupo, tolerancia y políticas
   aprobadas, con restricciones de rango en base de datos.
2. Crear `service_area_rules` con `tenant_id`, `service_id`, `area_id`, activo,
   inicio/fin locales, intervalo, pacing, duración por grupo, máximo de grupo,
   antelación y publicación web. El turno define valores por defecto; cada área
   permite terraza, sala y barra sin duplicar el turno.
3. Crear `scheduling_blocks`: ámbito de local o área, `period`, tipo (`closure`,
   `vacation`, `private_event`, `maintenance`, `last_minute`), efecto en web y
   personal, título visible, nota interna, autor y fechas de auditoría.
4. Migrar las filas actuales de `closures`; mantener una lectura compatible hasta
   retirar esa tabla en una entrega posterior. No eliminar datos históricos.
5. Añadir índices compuestos por tenant/local/fecha y por periodo de bloque según
   los planes de consulta reales.

### R1 · Operación atómica y auditoría

1. Crear RPC de reservar y RPC de modificar. Deben bloquear los recursos
   relevantes, excluir la reserva actual al editar y escribir reserva,
   asignaciones, holds y evento en una sola transacción.
2. Admitir una o varias mesas y `table_group_presets`; la selección optimiza el
   encaje sin superar aforo, pacing ni la regla de área.
3. Crear `reservation_events` append-only: reserva, actor interno/público, tipo,
   instante, cambio saneado y motivo. No guardar token ni payload de pago.
4. Llevar todos los flujos internos al nuevo motor antes de exponer ningún flujo
   público.

### R3 · Comensales

1. Crear `guest_tags` y `guest_tag_assignments`, incluidos slugs de etiquetas de
   sistema no borrables cuando corresponda.
2. Crear `guest_notes` con categoría, visibilidad, autor y fecha, para no perder
   incidencias al sobrescribir la nota actual. Migrar `notes`/`allergies` de forma
   explícita o mantener un resumen temporal compatible.
3. Canonizar teléfono y email y buscar por ambos dentro del tenant antes de crear
   un perfil. Si faltan ambos, avisar de posible duplicado deliberado.
4. Registrar canal de contacto y consentimiento; aplicar la política aprobada de
   acceso, exportación, retención y anonimización.

### R5–R7 · Comunicaciones, espera y grupos

1. Crear `reservation_manage_tokens`: hash, alcance (`confirm`, `manage`,
   `waitlist_offer`, `deposit`), relación, caducidad, revocación y uso. El secreto
   en claro solo aparece en la URL remitida al comensal.
2. Extender `waitlist` con estado, servicio/franja/área preferida, expiración,
   oferta, motivo de salida y reserva resultante. Migrar la cola presencial como
   tipo inmediato.
3. Crear `reservation_notification_jobs`: tipo, canal, idioma, programación,
   dedupe key, reintentos, resultado saneado y relación con reserva/espera.
4. Crear `reservation_group_terms` y `reservation_deposits`: condiciones
   congeladas, importe en céntimos, moneda, vencimiento, estado, proveedor,
   referencia e idempotencia. No almacenar medios de pago.

## 5. Casos de uso y permisos

### Personal interno

Implementar funciones de aplicación separadas para:

- cargar agenda de rango y filtros de día, semana, turno, área y estado;
- crear, editar hora/grupo, reasignar, confirmar, cancelar y marcar no-show;
- configurar turnos, reglas por área, presets de grupo y bloques;
- buscar, crear o fusionar cliente; etiquetar y añadir nota interna;
- obtener historial con reservas, visitas, cancelaciones, no-shows y gasto;
- gestionar espera, ofertas y sus caducidades; y
- registrar condiciones y revisar depósitos/reembolsos de grupo.

Owner y manager configuran reglas, bloques y depósitos. Host opera agenda,
clientes y espera. Waiter solo recibe el mínimo dato útil durante el servicio.
Cada mutación deriva tenant/local de la ruta autorizada, no del formulario, y
devuelve errores de negocio estables (`closed`, `no_capacity`, `conflict`,
`outside_policy`, `expired`).

### Reserva y autoservicio público

1. Crear ruta pública fuera de `/t`, por ejemplo
   `/reservar/$tenantSlug/$venueSlug`. Debe resolver una vista pública mínima de
   tenant, local y configuración publicada; nunca reutilizar loaders internos.
2. Solicitar solo nombre, tamaño, fecha/hora, área opcional, contacto y
   consentimiento. Aplicar esquema Zod, límite de tamaño, rate limit y defensa
   antiabuso aprobada.
3. Crear con el mismo motor transaccional, `source=web`, evento, token de gestión
   y trabajo de confirmación. La respuesta no revela agenda, mesas ni PII.
4. El enlace permite leer solo esa reserva y confirmar, cancelar o proponer un
   cambio dentro de su política. Valida alcance, hash, uso, caducidad, depósito y
   disponibilidad; rota o revoca el token según el caso.
5. Servir las páginas con token con `Cache-Control: no-store`; no registrar la URL
   completa ni PII en logs.

Las tablas internas conservan RLS para personal autenticado. El acceso público es
un endpoint/RPC mínimo y limitado o un caso server-only controlado: no se añade
una política `anon` general sobre `guests`, `reservations`, asignaciones o notas.

## 6. Diseño de interfaz

### Agenda interna

- Reemplazar el formulario único por selector de local, fecha, día/semana/turno,
  área y estado; persistir filtros validados en la URL y ofrecer lista accesible.
- Día: rejilla por hora y área/mesa con tarjetas de hora, grupo, estado, contacto,
  etiquetas y alertas. Semana: capacidad y bloqueos por turno. Turno: llegadas,
  mesas y espera en secuencia operativa.
- Todo mover/arrastrar/reasignar abre confirmación o llama al caso de modificación;
  si hay conflicto se explica y se sugieren alternativas. No actualizar en cliente
  sin confirmación del motor.
- El detalle reúne asignaciones, notas internas, historial resumido, eventos,
  condiciones de grupo y estado de depósito. Alertas sensibles no dependen solo
  de color.

### Configuración, bloques y cliente

- Editor de turnos/reglas por área con vista previa de franjas que se publicarán.
- Calendario de bloques con alcance, tipo, periodo y efecto. Si afecta reservas
  existentes, mostrar impacto y obligar a elegir mantener, recolocar, cancelar o
  contactar; nunca cancelar en silencio.
- Ficha con búsqueda por contacto, etiquetas, notas, alergias, carrito, mascota,
  cumpleaños, VIP, preferencias e incidencias. Distinguir dato sensible de
  etiqueta operativa y respetar permisos.

### Público

- Flujo móvil y accesible: grupo → fecha → franja/área → contacto/política →
  confirmación. Explicar límites, cancelación y depósito antes de enviar datos.
- Éxito con referencia no adivinable y expectativa de mensaje. Gestión desde
  enlace sin cuenta interna y sin posibilidad de acceder a otra reserva.

## 7. Recordatorios, espera y grupos

### Recordatorios

1. Al confirmar, programar recordatorios configurados por local (por ejemplo 24 h
   y 2 h antes), deduplicados por reserva/tipo/instante.
2. Antes de entregar, volver a leer estado, contacto, consentimiento y hora. Una
   reserva cancelada, modificada o sin opt-in no recibe mensajes obsoletos.
3. Guardar envío, reintentos y rebotes. Permitir reenvío consciente al personal,
   sin exponer tokens.

### Lista de espera con aviso

1. Cuando falte disponibilidad, registrar ventana/turno/área, no solo espera en
   puerta. Mantener claramente diferenciadas las personas ya presentes.
2. Tras cancelación, cambio, liberación de bloque o aumento de capacidad, evaluar
   FIFO de candidatos compatibles y crear una oferta temporal con hold.
3. Avisar al primer candidato según política. Al aceptar, reservar mediante la RPC
   atómica y cerrar ofertas incompatibles; al caducar/rechazar, registrar motivo y
   continuar. Una baja no puede crear más de una oferta activa incompatible.

### Grupos y depósitos

1. Por encima del umbral, iniciar flujo de grupo: solicitud/pre-reserva, nota
   interna, preset/mesas propuestos y condiciones específicas.
2. Congelar importe, plazo, cancelación, asistencia y reembolso antes del pago;
   el comensal usa enlace temporal del proveedor.
3. Procesar el webhook firmado e idempotente: éxito confirma; fallo o vencimiento
   libera hold/mesas y puede activar la espera. Un reembolso exige motivo,
   autorización y evento.
4. Integrar el depósito con la cuenta mediante una regla contable explícita y con
   trazabilidad; nunca alterar pagos históricos sin registro.

## 8. Orden de entrega y salida

| Entrega | Trabajo                                                               | Aceptación                                                  |
| ------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| R0      | Aprobar decisiones, estados, políticas, mensajes y proveedor          | Sin supuestos funcionales o legales implícitos              |
| R1      | Motor transaccional, reglas por área, bloques, eventos y concurrencia | No hay doble mesa ni salto de aforo/regla al crear o editar |
| R2      | Agenda y configuración internas                                       | Host gestiona día, semana y turno sin formulario técnico    |
| R3      | Cliente, etiquetas, notas e historial derivado                        | Gasto solo aparece para visitas cobradas vinculadas         |
| R4      | Web pública, confirmación y enlace de gestión                         | Un anónimo gestiona solo su propia reserva                  |
| R5      | Outbox, worker/cron, confirmaciones y recordatorios                   | Mensajes idempotentes y no obsoletos                        |
| R6      | Espera futura, ofertas, holds y aceptación                            | La aceptación no sobrevende ni duplica una oferta           |
| R7      | Grupos, depósitos, webhook y reembolsos                               | Reintentos no duplican cargo, reserva o reembolso           |
| R8      | Seguridad, accesibilidad, piloto, runbook y despliegue gradual        | Piloto aprobado y sin incidencias críticas                  |

R4, R5 y R7 dependen de R1. No se expone la web ni se cobra un depósito con el
actual flujo dividido en varias lecturas y escrituras.

## 9. Pruebas, seguridad y operación

### Automatización obligatoria

- Dominio: tamaños, duración, capacidad, combinaciones, área, zona horaria/DST y
  transiciones.
- Aplicación: validadores, roles, errores, agenda y política de cambios.
- Base de pruebas: RLS entre tenants, acceso anónimo mínimo, RPC concurrente,
  `EXCLUDE`, triggers y migración de datos existentes.
- Integración: tokens válidos/caducados/revocados, rate limit, mensajes dedupe,
  webhook firmado, reintentos y reembolsos.
- E2E accesible: teclado en agenda, reserva pública, enlace, oferta de espera y
  depósito simulado.

### Paso previo a producción

1. Crear el proyecto Supabase de pruebas y activar las pruebas RLS hoy omitidas;
   nunca ejecutar fixtures, cargas o concurrencia contra producción.
2. Probar migraciones con copia anonimizada, rollback lógico y métricas de RPC,
   conflictos, conversión, no-shows, ofertas y entregas.
3. Configurar secretos solo en servidor, firma de proveedores, límites de tasa,
   alertas de cron/webhooks y observabilidad sin PII.
4. Ejecutar `pnpm quality` y `pnpm build`; registrar fecha, commit y resultado en
   `implementation-status.md`.
5. Pilotar con un local, formar al host, importar solo datos consentidos y liberar
   por tenant con feature flag y soporte de cambios urgentes.

## 10. Riesgos abiertos

- El cálculo actual lee varias tablas y escribe después; es una buena base, pero
  no basta para reservar públicamente con concurrencia.
- Alergias e incidencias requieren modelo de permisos, consentimiento y retención
  revisado legalmente antes de su captación desde web.
- Mensajería, pagos y cron requieren proveedor, coste y secretos externos; no se
  añade una dependencia ni se configura un secreto sin aprobación.
- Un bloqueo de última hora puede afectar confirmadas: se debe mostrar impacto y
  exigir decisión humana antes de cancelar o notificar.
