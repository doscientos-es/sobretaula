# Plan ejecutable para completar el MVP ampliado

Estado: activo. Última revisión: 2026-09-10.

Este backlog convierte `client-mvp-petition.md`, `project-design.md`,
`mvp-roadmap.md`, `reservations-completion-plan.md` y los ADR en entregas que
un agente puede ejecutar en orden. La petición del cliente prevalece si hay
conflicto. No se considera terminado un bloque sin pruebas, accesibilidad,
autorización en servidor y actualización de `implementation-status.md`.

## Acuerdo de ejecución vigente

Esta sección prevalece sobre las dependencias históricas de este backlog.

- El flujo diario se centraliza en `/t/:slug/l/:venue/tpv`; las rutas actuales
  se conservan como administración compatible durante la transición.
- Se mantienen los roles existentes. Host y waiter operan mesas y anulan líneas
  no cobradas con motivo; owner y manager aplican descuentos, devoluciones,
  arqueo, cierre y ajustes financieros.
- Se encolan de forma idempotente servicio, comandas y efectivo cuando no hay
  red. Los cobros de tarjeta requieren confirmación online.
- La reserva web se confirma automáticamente conforme a reglas del restaurante.
  No hay depósito por defecto; owner y manager pueden configurarlo para grupos.
  Cambio o cancelación pública se permite hasta dos horas antes inicialmente.
- Se entrega correo electrónico; SMS y WhatsApp no se activan sin proveedor y
  consentimiento configurados. Fichaje estará disponible desde terminal y móvil.
- Hardware de impresión, cajón y datáfono queda fuera del MVP actual. La tarjeta
  se registra manualmente y la operativa se completa desde navegador/tablet.
- El IVA de restauración se preselecciona al 10 % según la guía vigente de AEAT.
  Cada producto conserva un tipo explícito editable (0 %, 4 %, 10 % o 21 %).
- VERI*FACTU es opcional: pruebas por defecto; producción solo tras identidad
  fiscal, serie, certificado válido y adaptador AEAT configurados por el owner.
- No se crea ningún Supabase nuevo. El existente solo recibe migraciones propias
  revisadas y nunca fixtures, humo, carga ni pruebas de concurrencia.

## Diagnóstico de partida

- Base disponible: tenancy, Auth y roles; plano y servicio; reservas internas y
  públicas parciales; agenda diaria; clientes básicos; cuenta, pagos simples y
  facturación en modo test; outbox de correo y depósitos modelados.
- Brechas de producto: el TPV unificado cubre cuenta, comandas, cola, cobro
  manual y mixto, caja, conciliación, informe financiero y reimpresión web;
  siguen pendientes sincronización offline del fichaje e inventario/escandallos
  de punta a punta. Hardware queda explícitamente fuera de esta fase.
- Brechas de fiabilidad: las tres pruebas RLS están omitidas porque no se
  conectan pruebas al único proyecto con datos reales; tampoco hay humo E2E ni
  concurrencia real contra ese proyecto.
- Riesgo previo: hay prefijos de migración repetidos (por ejemplo `...00026`,
  `...00031` y `...00035`). Antes de cualquier migración, reconciliar el
  historial con el proyecto existente y normalizar versiones futuras.
- Ámbito protegido: hay cambios locales no confirmados en `features/account`.
  No se modifican ni se incluyen en una entrega sin confirmación de su autor.

## Reglas de ejecución

1. Una tarea es un PR pequeño, desplegable y verificable; no mezclar verticales.
2. Toda migración nueva es incremental, lleva RLS, índices y pruebas. Solo se
   aplica al proyecto autorizado cuando sea una migración propia revisada, con
   destino inequívoco, seguida de verificación de esquema.
3. Nunca usar producción para fixtures, concurrencia, humo o pruebas RLS.
4. Cada UI aporta es/ca, estados carga/vacío/error/sin permiso/offline, teclado,
   foco, WCAG 2.2 AA y el diseño del dispositivo objetivo.
5. Toda mutación usa autorización por invocación, `operation_id`/dedupe cuando
   proceda y auditoría sin PII ni secretos. Ejecutar `pnpm quality` y
   `pnpm build` al cerrar cada entrega.

## Gates externos (bloquean solo sus dependientes)

| ID  | Decisión o recurso                                             | Necesario para                   |
| --- | -------------------------------------------------------------- | -------------------------------- |
| G1  | Evidencia automatizada sin usar datos reales como prueba       | E0 y validación de esquema       |
| G2  | Variante TPV: nativo, integración o exportación temporal       | E3--E6                           |
| G3  | Hardware de impresión, cajón y datáfono                        | Fuera de alcance del MVP actual  |
| G4  | Proveedor, coste y consentimientos para SMS/WhatsApp           | E8 (email puede avanzar)         |
| G5  | Asesoría: fiscal/VERI*FACTU y registro horario                 | E6, E10 y activación fiscal prod |
| G6  | Merchant distinto del restaurante para depósitos y reglas      | E9                               |
| G7  | Política de retención, exportación y anonimización de clientes | E8--E9                           |

## Backlog secuenciado

### E0 — Entorno seguro y evidencia de base (P0)

- [x] **E0.1 · Inventario de esquema.** Confirmado el único proyecto autorizado,
      reconciliado `migration list` y aplicadas individualmente las migraciones
      pendientes revisadas. No se cambia historial previamente aplicado.
- [ ] **E0.2 · Evidencia reproducible.** Añadir CI para controles estáticos,
      pruebas unitarias y revisión de migraciones sin secretos expuestos ni
      conexión de pruebas al proyecto con datos reales.
- [ ] **E0.3 · Seguridad y carreras.** Ampliar RLS a anónimo, tenant/rol/local
      ajeno y Storage; probar carreras de reserva, seating/movimiento, pago, cierre
      e invoice; verificar recuperación tras reintento y doble clic.
- [ ] **E0.4 · Observabilidad/auditoría.** Registro append-only legible para
      reservas, mesas, anulaciones, descuentos, cobros, caja y fiscalidad; runbook
      de backup/restore y recuperación de sesiones abiertas.

**Salida:** CI verde para código y migraciones revisadas, sin acceso cruzado
por diseño, sin doble ocupación/cobro/número fiscal en contratos cubiertos y
con procedimientos de recuperación documentados.

### E1 — Configuración operativa y reservas internas (P0)

- [ ] **E1.1 · Turnos y reglas.** CRUD de turnos, intervalos, duración por
      grupo, antelación, aforo/límites, máximo web y reglas por área.
- [ ] **E1.2 · Bloques con impacto.** Incorporar los bloques al cálculo interno;
      vista de impacto y decisión explícita de recolocar, mantener, cancelar o
      contactar reservas afectadas.
- [ ] **E1.3 · Motor transaccional único.** Crear/editar/cancelar/asignar por RPC
      atómica, con múltiples mesas/presets, eventos, errores tipados y DST.
- [ ] **E1.4 · Agenda útil.** Día, semana, turno, lista/cronología/plano, filtros
      en URL, búsqueda, duplicar/trasladar y comunicaciones manuales.

**Salida:** host gestiona capacidad y excepciones de varios locales sin doble
reserva ni formularios técnicos.

### E2 — Reserva pública vendible y clientes (P0)

- [x] **E2.1 · Flujo público completo.** Calendario, personas, área, contacto,
      comentarios, privacidad, alternativas, confirmación y recordatorio 24 h.
      El refuerzo aplicado añade rate limit por contacto y condiciones de reserva
      versionadas, con la versión aceptada congelada en cada reserva. Pendientes
      validación operativa y política de retención/privacidad.
- [ ] **E2.2 · Autogestión segura.** Token con `no-store`, caducidad/rotación y
      políticas para confirmar, modificar o cancelar; no revelar mesas ni PII.
- [x] **E2.3 · Cliente y privacidad.** Ficha con historial de reservas,
      cancelaciones, no-shows, visitas y gasto, además de etiquetas, notas,
      alergias, preferencias, consentimientos y deduplicación/fusión. Pendientes
      exportación/retención según G7 y permisos de datos sensibles revisados.

**Salida:** un anónimo reserva y gestiona únicamente su reserva; el host ve su
historial y la agenda actualizada bajo las políticas aprobadas.

### E3 — Catálogo y comandas para TPV (P1)

- [x] **E3.1 · Catálogo operativo.** Categorías, productos, IVA, precios por
      local/canal, disponibilidad, alérgenos, modificadores y destino cocina/barra.
- [x] **E3.2 · Comanda.** Añadir/editar/anular cantidades y notas rápidamente,
      congelar precio/modificador/IVA/destino y asociar cada línea a la sesión.
- [ ] **E3.3 · Envío fiable.** Estados enviados/recibidos/preparando/listo/
      entregado, reenvío idempotente, cola offline y auditoría de anulaciones.

**Salida:** camarero completa una comanda desde móvil/tablet sin duplicarla y la
cuenta abierta refleja exactamente las líneas enviadas.

### E4 — Cocina y barra (P1)

- [ ] **E4.1 · Ticket de preparación.** Modelo de batches por estación, cola en
      pantalla, prioridades/notas, cambios de estado y trazabilidad por línea.
- [ ] **E4.2 · KDS accesible.** Pantallas separadas por destino, filtro de turno,
      tiempos de preparación, estados de red y reimpresión segura desde la web.

**Salida:** cocina y barra reciben solo sus partidas y sala conoce cuándo están
listas sin comunicación paralela.

### E5 — Cuenta, cobros y documentos (P1)

- [ ] **E5.1 · División y movimientos.** Dividir por persona, importe, producto
      y porcentaje; mover líneas entre sesiones y preservar inmutabilidad/auditoría.
- [ ] **E5.2 · Ajustes controlados.** Descuentos, invitaciones, anulaciones,
      reapertura y correcciones con permiso, motivo y reglas fiscales.
- [x] **E5.3 · Pago robusto.** Efectivo/tarjeta/transferencia/vale/propina y pago
      mixto idempotentes; devoluciones y conciliación por método.
- [x] **E5.4 · Salida fiscal.** Ticket/reimpresión web, factura simplificada/completa,
      rectificativas y cadena VERI*FACTU test. Activación prod solo tras G5.

**Salida:** una mesa se cobra y documenta correctamente, incluso dividida y con
pagos mixtos, sin sobrecobro ni pérdida de trazabilidad.

### E6 — Caja, terminal e integraciones TPV (P1)

- [x] **E6.1 · Caja.** Apertura, fondo, entradas/salidas, arqueo, diferencia,
      cierre por método, permisos y auditoría.
- [x] **E6.2 · Sesión de terminal/PIN.** Alta y rotación segura de PIN, límite de
      intentos, terminal identificada y operación server-side por local.

**Salida:** el cierre de caja concilia con los cobros y la terminal web puede
operar según su rol sin exponer credenciales. La integración con hardware queda
fuera de esta fase.

### Entregas TPV financieras completadas (D9)

- [x] Pagos mixtos atómicos e idempotentes, con lote auditable por cuenta.
- [x] Histórico financiero por rango: propinas, pagos mixtos, cierres y arqueos.
- [x] Conciliación avanzada de efectivo por local, turno y devoluciones.
- [x] Reimpresión web del ticket de cuenta, sin hardware.

### Entregas TPV completadas (D1–D3)

- [x] **D1 · Entrada única.** `/t/:slug/l/:venue/tpv` centraliza el resumen de
      sala, selección de cuentas y navegación operativa, sin duplicar el tablero.
- [x] **D2 · Cuenta y comandas.** Cuenta embebida, notas, anulaciones auditadas
      e inmutables y altas idempotentes con cola offline de tipo B.
- [x] **D3 · Cocina, cobro, caja e informes.** Cola de preparación, cobro
      manual de tarjeta, permisos de ajustes, caja/arqueo e informe diario dentro
      del TPV. Hardware y conciliación financiera permanecen fuera de esta entrega.

### E7 — Informes y activación del propietario (P1)

- [x] **E7.1 · Informes mínimos.** Ventas/IVA/método/producto/ticket medio,
      descuentos, propinas, pagos mixtos y cierres/arqueos por local, día y turno,
      con exportación compatible.
- [ ] **E7.2 · Onboarding/importación.** Asistente de local, turnos, zonas,
      mesas, carta, impuestos y equipo; importación CSV con preview y errores.
- [ ] **E7.3 · Inventario y producto.** Existencias, movimientos, escandallos,
      alérgenos y precios por canal, según el alcance ampliado documentado.

**Salida:** propietario configura el primer servicio e interpreta los cierres y
ventas sin intervención técnica.

### E8 — Comunicaciones y lista de espera (P2)

- [ ] **E8.1 · Email transaccional.** Plantillas por restaurante/idioma,
      confirmación y recordatorio 24 h ya están activos con dedupe y reintento;
      quedan rebotes, reenvío manual y validación operativa del proveedor.
- [x] **E8.2 · Espera futura.** FIFO compatible, fecha/hora solicitada,
      estados de espera/oferta/aceptación/caducidad/cancelación y operación
      desde Servicio sin borrar el registro. Pendientes validación de aviso al
      liberar capacidad y humo de sobreventa.
- [ ] **E8.3 · SMS/WhatsApp.** Solo después de G4/G7, mediante outbox equivalente.

### E9 — Grupos, depósitos y no-shows (P2)

- [ ] **E9.1 · Política de grupo.** Umbrales, términos congelados, confirmación
      pendiente, cancelación/no-show y métricas de cubiertos recuperados.
- [ ] **E9.2 · Depósitos.** Tras G6, checkout externo, webhook firmado,
      idempotencia, vencimiento/liberación de holds, reembolso autorizado y asiento
      explícito en la cuenta.

### E10 — Control horario integrado (P3)

- [ ] **E10.1 · Modelo legal.** Cerrar G5 y migrar empleados, centros y eventos
      append-only con encadenado de integridad.
- [ ] **E10.2 · Fichaje PIN.** Entrada, pausa, regreso y salida; límites contra
      intentos y terminal ya están implementados. Queda sincronización offline
      idempotente.
- [ ] **E10.3 · Jornada/exportación.** Tramos partidos, cruce de medianoche,
      nocturnidad, festivos, portal y exportación ya están implementados de forma
      indicativa. Quedan informes avanzados, cambios de centro y validación para
      inspección/nóminas.

### E11 — Certificación de entrega (P0 transversal)

- [ ] **E11.1 · E2E y QA.** Smoke: alta → local/plano/carta → reserva → sentar →
      comanda → cocina → cobro → ticket/factura → arqueo/cierre; fichaje y exportación.
- [ ] **E11.2 · Piloto.** Feature flags, formación, datos consentidos, soporte,
      métricas y ensayo de corte de red/multidispositivo.
- [ ] **E11.3 · Cierre.** Checklist de seguridad/fiscal, runbooks, CI, evidencia
      de calidad y aprobación explícita del piloto por restaurante y asesoría.

## Definition of Done del MVP

Solo se marca completo tras un piloto controlado y un servicio completo:
reserva, sala, comanda, preparación, cobro/ticket, caja/cierre, fichaje y
exportación. Deben quedar demostrados permisos/RLS, offline y recuperación,
deduplicación, auditoría, accesibilidad y los controles de calidad, sin usar
datos reales como fixtures de prueba.
