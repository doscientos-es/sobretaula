# SobreTaula · Hoja de ruta del MVP operativo

Estado: propuesta de ejecución. Última revisión: 2026-09-10.

Este documento convierte la tesis de producto en orden de trabajo. Es la guía
para cualquier agente que continúe SobreTaula: no añadir funcionalidades por
atractivo aislado; completar primero el flujo que hace que un restaurante opere
mejor que con agenda, papel, Excel y su TPV actual.

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
- No construir un TPV completo ni hardware propio antes de saber, con pilotos,
  qué integración o flujo de cobro evita más trabajo duplicado.
- Mantener todas las operaciones privadas autorizadas en servidor y cubiertas
  por RLS; una mejora de producto no justifica relajar estas garantías.
- Añadir a cada funcionalidad una métrica de adopción o de resultado operativo.

## Fase 0 · Fiabilidad para servicio real

**Objetivo:** poder operar con restaurantes piloto sin riesgo de fuga de datos,
duplicados o pérdida silenciosa de trabajo.

### Trabajo

1. Crear un proyecto Supabase de pruebas y ejecutarlo en CI desde migraciones
   vacías.
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

No iniciar comandas de cocina, impresoras, arqueo de hardware o un TPV nativo
hasta entrevistar a los pilotos y elegir entre:

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

## Fuera del MVP actual

No iniciar estos frentes hasta que las fases anteriores estén funcionando con
pilotos reales y exista evidencia de demanda recurrente:

- Delivery.
- Inventario, compras y escandallos.
- Fidelización y marketing automatizado.
- RRHH y planificación de turnos de empleados.
- Marketplace propio de reservas.
- Hardware TPV, impresoras y cocina nativos.
- Analítica predictiva o IA.

## Medición mínima por fase

Registrar al menos estos eventos, siempre sin exponer datos personales en
telemetría: reserva creada/confirmada/cancelada/no-show, mesa sentada/movida/
liberada, walk-in, cuenta abierta/cerrada/anulada, pago fallido y acción de
lista de espera. Cada fase debe definir antes de implementarse qué mejora de
adopción, tiempo, cubiertos recuperados o trabajo evitado pretende conseguir.
