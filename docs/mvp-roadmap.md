# SobreTaula · Hoja de ruta del MVP operativo

Estado: propuesta de ejecución. Última revisión: 2026-09-10.

Este documento convierte la tesis de producto en orden de trabajo. Es la guía
para cualquier agente que continúe SobreTaula: no añadir funcionalidades por
atractivo aislado; completar primero el flujo que hace que un restaurante opere
mejor que con agenda, papel, Excel y su TPV actual.

La petición del cliente incluye además TPV, control horario, caja, cocina,
hardware y facturación como parte del MVP. Esa diferencia con el alcance
histórico de esta hoja de ruta está analizada en
[`client-mvp-gap-analysis.md`](./client-mvp-gap-analysis.md). Si el objetivo es
cumplir el MVP del cliente, esa matriz tiene prioridad sobre las exclusiones o
fases posteriores de este documento.

## Norte de producto

SobreTaula debe ayudar al restaurante a conseguir tres resultados diarios:

1. No perder reservas ni dejar huecos recuperables vacíos.
2. Dirigir la sala con menos caos y menos comunicación manual.
3. Cerrar una mesa sin duplicar trabajo ni perder trazabilidad.

El plano de sala en vivo es el diferenciador. No es una ilustración: reservas,
servicio y cuentas deben referirse a la misma escena operativa.

## Punto de partida

El diseño y la implementación actuales incluyen tenancy, roles, plano de sala,
motor de reservas interno, vista de servicio, cuenta de mesa simple,
facturación en modo test y facturación SaaS. El estado exacto y sus evidencias
viven en [implementation-status.md](./implementation-status.md).

No se debe interpretar «implementado» como listo para uso de producción: faltan
pruebas contra un entorno Supabase dedicado, verificación de migraciones y la
validación fiscal necesaria para activar VERI*FACTU en producción.

## Reglas de priorización

- Antes de empezar una fase, completar y verificar su fase anterior.
- Preferir un flujo vertical completo a un módulo parcialmente terminado.
- El TPV completo, cocina, caja, control horario, inventario y carta forman
  parte del MVP ampliado del cliente; deben entregarse por verticales y con
  dependencias explícitas.
- Mantener todas las operaciones privadas autorizadas en servidor y cubiertas
  por RLS; una mejora de producto no justifica relajar estas garantías.
- Añadir a cada funcionalidad una métrica de adopción o de resultado operativo.

## Principios de experiencia, interfaz y accesibilidad

La calidad visual y la accesibilidad no son una fase posterior. Cada pantalla
debe ser rápida de entender durante un servicio, agradable de mirar durante una
configuración y posible de operar sin ratón o sin depender de un único sentido.

### Principios de interfaz

1. **La sala manda.** La pantalla de servicio prioriza plano, estado y próxima
   acción; la configuración y los informes nunca compiten visualmente con ella.
2. **Una acción principal por contexto.** En cada pantalla debe ser obvio qué
   hacer ahora: sentar, crear reserva, cobrar, guardar o continuar. Las acciones
   destructivas o poco frecuentes se colocan en menús secundarios.
3. **Estado antes que decoración.** Color, icono y texto comunican ocupación,
   alerta, disponibilidad y error. No usar color como único indicador.
4. **Jerarquía serena.** Espacio suficiente, tipografía legible, pocos bordes,
   contraste alto y densidad adaptable: compacta en servicio, cómoda en
   configuración y escritorio.
5. **Respuesta inmediata.** Una pulsación siempre muestra resultado, estado de
   carga o error recuperable; no dejar la interfaz ambigua tras una mutación.
6. **Diseño de datos real.** Vacíos, errores, carga, red inestable, permisos y
   primeros usos se diseñan con el mismo cuidado que el caso feliz.

### Dispositivos objetivo

| Contexto               | Dispositivo principal                  | Prioridad de diseño                            |
| ---------------------- | -------------------------------------- | ---------------------------------------------- |
| Jefe de sala / host    | Tablet táctil en vertical y horizontal | Plano, agenda del turno y acciones de una mano |
| Camarero               | Móvil                                  | Cuenta, estado de mesa y acciones mínimas      |
| Propietario / gerente  | Escritorio                             | Configuración, informes y facturación          |
| Comensal               | Móvil web                              | Reserva pública breve, clara y sin cuenta      |
| Operador de plataforma | Escritorio                             | Superadmin, soporte y salud de tenants         |

### Estándar mínimo de accesibilidad

Todo PR de interfaz debe cumplir WCAG 2.2 AA como mínimo:

- Navegación completa con teclado, orden de foco lógico y foco visible.
- Semántica HTML nativa antes de crear controles personalizados; `button`,
  `label`, `dialog`, tabla y encabezados cuando correspondan.
- Etiquetas asociadas, instrucciones y errores anunciables para todos los campos.
- Contraste AA, texto escalable al 200 %, objetivos táctiles de al menos 44 × 44
  CSS px y sin depender de hover para una acción esencial.
- Estados que no dependen solo de color: icono/texto/patrón además del color.
- Modales que atrapan el foco, se cierran con Escape cuando sea seguro y devuelven
  el foco al activador.
- Mensajes de éxito, error y carga mediante regiones `aria-live` adecuadas, sin
  interrumpir innecesariamente al lector de pantalla.
- Respeto por `prefers-reduced-motion`; nunca usar animación para transmitir
  información indispensable.
- Prueba con lector de pantalla en los flujos públicos y de servicio críticos.

### Definition of Done para cualquier pantalla

Una funcionalidad visual no está terminada hasta que incluye:

1. Estados de carga, vacío, error, permiso denegado y éxito.
2. Versión móvil/tablet/escritorio según su dispositivo objetivo.
3. Prueba de teclado y revisión de foco.
4. Revisión de contraste y objetivos táctiles.
5. Textos de interfaz concretos, breves y orientados a la acción; sin jerga de
   implementación.
6. Prueba automatizada de la interacción crítica y prueba manual en Supabase de
   pruebas con el rol correcto.
7. Captura o checklist de QA que demuestre el resultado antes de cerrar el PR.

## Secuencia de PRs

Cada PR debe ser pequeño, desplegable y demostrable en el Supabase online de
pruebas. No mezclar una capacidad nueva, una refactorización amplia y cambios
visuales sin relación.

| PR  | Resultado entregable                                                          | Roles de QA                 | Dependencia              |
| --- | ----------------------------------------------------------------------------- | --------------------------- | ------------------------ |
| 0   | Cerrar superadmin: listado, detalle, estados, permisos y estados vacíos/error | platform owner/support      | Ninguna                  |
| 1   | Página pública de reserva por local, conectada al motor existente             | anónimo, owner, host        | PR 0                     |
| 2   | Gestión pública segura: confirmación, cancelación y modificación              | anónimo, host               | PR 1                     |
| 3   | Agenda de turno y reglas visibles de capacidad/cierres                        | owner, manager, host        | PR 1                     |
| 4   | Recordatorios, confirmación pendiente y lista de espera                       | host, comensal              | PR 2–3                   |
| 5   | Sala en vivo: llegada, walk-in, sugerencia de mesa, retrasos y bloqueos       | host, waiter                | PR 3                     |
| 6   | Pacing, cronómetro, secciones y handover de turno                             | manager, host, waiter       | PR 5                     |
| 7   | Cuenta robusta: división, movimientos, descuentos auditados y pagos mixtos    | waiter, manager, accountant | PR 5                     |
| 8   | Depósitos y políticas de no-show para grupos                                  | owner, host, comensal       | PR 4 y proveedor de pago |
| 9   | Onboarding/importación y plantillas de operación                              | owner, manager              | PR 3 y 5                 |
| 10  | Indicadores operativos y resumen semanal                                      | owner, manager              | Eventos de PR 1–9        |
| 11  | Integración o exportación TPV guiada por pilotos                              | owner, manager, waiter      | PR 7                     |

El PR 1 es el siguiente trabajo de producto recomendado tras cerrar el
superadmin. La página pública se diseña primero como destino móvil propio; el
widget web se añade después reutilizando el mismo flujo, no como producto
paralelo.

## Ficha obligatoria antes de iniciar un PR

Cada PR debe empezar con una nota breve en su descripción o en el documento de
implementación que responda:

1. Qué dolor operativo elimina y para qué rol.
2. Qué recorrido de usuario completo se podrá demostrar al terminar.
3. Qué datos se leen/escriben, qué autorización los protege y qué migración se
   necesita, si la hay.
4. Qué ocurre si no hay red, no hay permisos o el dato ya cambió.
5. Qué dispositivo objetivo y qué comprobaciones de accesibilidad aplican.
6. Cómo se medirá uso o resultado.

## Sistema visual a consolidar antes de añadir muchas pantallas

Mantener y ampliar las primitivas de `@doscientos/ui`; no crear estilos aislados
por pantalla. Antes del PR 1, revisar que el sistema ofrezca y documente:

- Escala tipográfica, espaciado, radio, sombras y anchos de lectura consistentes.
- Colores semánticos (`success`, `warning`, `danger`, `info`, `muted`) con pares
  de fondo/texto contrastados.
- Botones, icon buttons, inputs, select, combobox, date/time picker, tabs,
  badges, toasts, dialog y confirmación destructiva accesibles.
- Skeleton, empty state, error state y loading state reutilizables.
- Patrones de cabecera, barra de acciones, panel lateral y bottom sheet para
  tablet/móvil.
- Iconografía con etiqueta accesible o `aria-hidden` correcto; no iconos sin
  nombre para controles interactivos.

La revisión no debe bloquear el PR 1 con una reescritura de diseño: arreglar la
primitiva cuando se necesite y reutilizarla desde entonces.

## Fase 0 · Fiabilidad para servicio real

**Objetivo:** poder operar con restaurantes piloto sin riesgo de fuga de datos,
duplicados o pérdida silenciosa de trabajo.

### Trabajo

1. Mantener CI de controles estáticos, unitarios y revisión de migraciones sin
   conectar pruebas ni datos sintéticos al único proyecto con datos reales.
2. Añadir pruebas de integración para RLS: anónimo, miembro de otro tenant,
   rol insuficiente y acceso por local restringido.
3. Probar concurrencia en reservas, sentar/mover mesas, crear cuentas y emitir
   facturas. Dos usuarios nunca pueden ocupar ni cobrar dos veces el mismo
   recurso por una carrera.
4. Garantizar idempotencia de las acciones mutables ante doble clic, reintento,
   recarga y respuesta de red tardía.
5. Añadir auditoría legible de movimientos de mesa, reservas, anulaciones,
   descuentos, cierres y modificaciones fiscales.
6. Definir recuperación ante pérdida de conexión de una tablet: estado pending,
   error visible y reintento seguro.
7. Completar la validación de certificados, runtime y asesor fiscal antes de
   permitir `VERIFACTU_ENV=prod` a un tenant.

### Criterio de salida

Un piloto puede completar un servicio de prueba con varios usuarios y locales
sin acceso cruzado, sobreasignaciones, cobros duplicados ni errores invisibles.

## Fase 1 · Reservas completas y directas

**Objetivo:** que la reserva llegue y se gestione sin depender de teléfono,
WhatsApp, libreta o una herramienta externa.

### Trabajo, por orden

1. Agenda de reservas por día, semana y turno.
2. Configuración de horarios, turnos, aforo, duración, cierres excepcionales,
   eventos privados y reglas específicas por zona.
3. Reserva pública por enlace y widget web, aislada por tenant y local.
4. Enlace reutilizable para Google Business Profile, Instagram y WhatsApp;
   registrar el canal de origen de cada reserva.
5. Flujo público para confirmar, cancelar o modificar una reserva dentro de las
   reglas del restaurante.
6. Confirmaciones y recordatorios por email. Añadir SMS o WhatsApp solo cuando
   existan consentimiento, coste y proveedor definidos.
7. Etiquetas, notas e historial del cliente: preferencias, alergias, bebé,
   mascota, VIP, incidencias, visitas y cancelaciones.
8. Lista de espera con caducidad de oferta cuando se libera una mesa.
9. Flujo específico de grupos: notas internas, reglas de turno y preparación
   para garantía o depósito.

### Criterio de salida

Una reserva pública entra en la agenda y el plano, respeta todas las reglas de
capacidad y puede confirmarse, modificarse o cancelarse sin intervención del
equipo.

## Fase 2 · No-shows y recuperación de demanda

**Objetivo:** proteger cubiertos y recuperar mesas que de otro modo quedarían
vacías.

### Trabajo, por orden

1. Estado de reserva pendiente de confirmación con vencimiento configurable.
2. Recordatorio con acciones directas: confirmar, cancelar o comunicar retraso.
3. Políticas de no-show y cancelación según turno y tamaño de grupo.
4. Notificación a lista de espera y aceptación temporal de una mesa liberada.
5. Garantía de tarjeta o depósito para grupos, usando un proveedor de pago sin
   almacenar datos de tarjeta en SobreTaula.
6. Reglas auditables para cobrar, anular o devolver depósitos.
7. Informe de no-shows, cancelaciones tardías, cubiertos recuperados e importe
   protegido.

### Criterio de salida

El gerente puede aplicar una política distinta a grupos, y el sistema demuestra
qué mesas y cubiertos se recuperaron gracias a confirmaciones y lista de espera.

## Fase 3 · Sala en vivo que sustituye a la libreta

**Objetivo:** hacer que host y jefe de sala prefieran operar con SobreTaula.

### Trabajo, por orden

1. Vista de servicio inmediata: llegadas pendientes, retrasos, walk-ins, espera
   y mesas abiertas, sin cambiar de pantalla.
2. Sugerencia de mesa basada en capacidad, zona, disponibilidad, preferencias y
   próxima reserva.
3. Pacing: visualización y alertas ante concentración de llegadas o carga de
   cocina excesiva.
4. Unir y separar mesas preservando reservas, comensales y cuenta asociada.
5. Bloqueos operativos por limpieza, incidencia, mantenimiento o evento.
6. Cronómetro de mesa y alertas configurables para pedido, cuenta y liberación.
7. Secciones o rangos asignables a camareros.
8. Handover entre turnos: mesas abiertas, cuentas pendientes y reservas
   inminentes.
9. Revisión de uso táctil: botones, feedback, latencia y recuperación tras red
   inestable en tablet.

### Criterio de salida

Un jefe de sala puede gestionar un turno completo desde el plano sin llevar una
libreta paralela ni coordinar cambios por mensajería interna.

## Fase 4 · Cuenta y cierre de mesa robustos

**Objetivo:** terminar la operación de mesa sin duplicar trabajo antes de
decidir construir un TPV completo.

### Trabajo, por orden

1. Añadir productos, modificadores y notas de cocina de manera rápida.
2. Dividir una cuenta por persona, importe, producto y porcentaje.
3. Unir cuentas, mover productos entre mesas y conservar trazabilidad.
4. Descuentos, invitaciones y anulaciones con permisos, motivo y auditoría.
5. Pagos mixtos: efectivo, tarjeta, transferencia, vale y propina.
6. Corrección o reapertura de cuentas cerradas bajo reglas estrictas.
7. Ticket, factura simplificada y factura completa desde el cierre.
8. Cierre y arqueo por turno.
9. Exportación estructurada o integración con el TPV más utilizado por pilotos.

### Decisión de producto obligatoria antes de continuar

Antes de cerrar comandas, impresoras, arqueo de hardware o TPV nativo hay que
confirmar con los pilotos la variante técnica, pero estas capacidades siguen
dentro del MVP. Elegir entre:

- integración con el TPV que ya usan;
- exportación fiable para su circuito actual; o
- TPV nativo, solo si el flujo repetido justifica su coste y soporte.

### Criterio de salida

Una mesa se puede cerrar correctamente, incluso con división y pagos mixtos,
sin reintroducir la información en otra aplicación.

## Fase 5 · Activación rápida y gestión del propietario

**Objetivo:** que el restaurante llegue al primer servicio útil en días, no en
semanas.

### Trabajo

1. Asistente de configuración de locales, horarios, turnos, zonas, mesas,
   carta, impuestos y usuarios.
2. Importación CSV de carta, clientes y reservas futuras, con vista previa y
   reporte de errores.
3. Plantillas y duplicación de planos, zonas y turnos.
4. Versionado y previsualización de cambios de plano u horario antes de
   publicarlos.
5. Configuración aislada por local para empresas multi-local.

### Criterio de salida

Un restaurante puede configurar su operación básica e importar sus datos sin
intervención técnica ni una migración manual.

## Fase 6 · Indicadores que ayudan a decidir

**Objetivo:** demostrar al gerente cómo mejora la operación; no crear un panel
genérico de gráficos.

### Indicadores iniciales

1. Ocupación y cubiertos por turno.
2. Duración media de mesa y rotación.
3. Reservas, walk-ins, cancelaciones y no-shows.
4. Antelación media de la reserva.
5. Demanda perdida: solicitudes sin mesa y espera no convertida.
6. Canal de origen de las reservas.
7. Gasto medio por mesa y cubierto, cuando las cuentas sean fiables.
8. Comparativa por día, turno, zona y local.
9. Resumen semanal para gerente.

### Criterio de salida

Cada indicador se puede conectar con una acción operativa: abrir capacidad,
ajustar turnos, activar confirmación, revisar una zona o reforzar personal.

## Integraciones en orden

1. Enlace y widget de reserva propios.
2. Google Business Profile, Instagram y WhatsApp como canales de entrada.
3. Email; después SMS/WhatsApp para mensajes transaccionales con consentimiento.
4. Pago para depósitos y garantías.
5. Un solo TPV dominante entre los pilotos, o una exportación sólida previa.
6. Contabilidad/gestoría por exportación antes de una API compleja.

## Fuera del MVP ampliado

Quedan fuera salvo nueva petición contractual:

- Marketplace propio de reservas.
- Analítica predictiva o IA.
- Automatizaciones de marketing avanzadas.
- Delivery propio; se mantiene la preparación para integraciones externas.

## Medición mínima por fase

Registrar al menos estos eventos, siempre sin exponer datos personales en
telemetría: reserva creada/confirmada/cancelada/no-show, mesa sentada/movida/
liberada, walk-in, cuenta abierta/cerrada/anulada, pago fallido y acción de
lista de espera. Cada fase debe definir antes de implementarse qué mejora de
adopción, tiempo, cubiertos recuperados o trabajo evitado pretende conseguir.
