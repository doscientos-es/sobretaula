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
- Hardware y datáfono se abstraen mediante adaptadores; la tarjeta se registra
  manualmente ahora y la impresión/cajón/KDS se configura por restaurante.
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
- Brechas de producto: TPV operativo, modificadores, cocina/barra, división y
  devolución de cobros, caja, PIN de terminal, informes, control horario,
  hardware e inventario/escandallos siguen sin vertical completo.
- Brechas de fiabilidad: no existe Supabase dedicado de pruebas, por lo que las
  tres pruebas RLS están omitidas; tampoco hay humo E2E ni concurrencia real.
- Riesgo previo: hay prefijos de migración repetidos (por ejemplo `...00026`,
  `...00031` y `...00035`). Antes de cualquier migración, reconciliar el
  historial con el proyecto de pruebas y normalizar versiones futuras.
- Ámbito protegido: hay cambios locales no confirmados en `features/account`.
  No se modifican ni se incluyen en una entrega sin confirmación de su autor.

## Reglas de ejecución

1. Una tarea es un PR pequeño, desplegable y verificable; no mezclar verticales.
2. Toda migración nueva es incremental, lleva RLS, índices y pruebas. Se aplica
   primero al Supabase de pruebas; solo se aplica a producción cuando sea una
   migración propia revisada, con proyecto destino inequívoco.
3. Nunca usar producción para fixtures, concurrencia, humo o pruebas RLS.
4. Cada UI aporta es/ca, estados carga/vacío/error/sin permiso/offline, teclado,
   foco, WCAG 2.2 AA y el diseño del dispositivo objetivo.
5. Toda mutación usa autorización por invocación, `operation_id`/dedupe cuando
   proceda y auditoría sin PII ni secretos. Ejecutar `pnpm quality` y
   `pnpm build` al cerrar cada entrega.

## Gates externos (bloquean solo sus dependientes)

| ID  | Decisión o recurso                                             | Necesario para                   |
| --- | -------------------------------------------------------------- | -------------------------------- |
| G1  | Proyecto Supabase no productivo, CI y credenciales de prueba   | E0 y toda entrega de esquema     |
| G2  | Variante TPV: nativo, integración o exportación temporal       | E3--E6 y hardware                |
| G3  | Modelos/protocolos de impresora, cajón y datáfono              | E6                               |
| G4  | Proveedor, coste y consentimientos para SMS/WhatsApp           | E8 (email puede avanzar)         |
| G5  | Asesoría: fiscal/VERI*FACTU y registro horario                 | E6, E10 y activación fiscal prod |
| G6  | Merchant distinto del restaurante para depósitos y reglas      | E9                               |
| G7  | Política de retención, exportación y anonimización de clientes | E8--E9                           |

## Backlog secuenciado

### E0 — Entorno seguro y evidencia de base (P0)

- [x] **E0.1 · Inventario de esquema.** Confirmado el único proyecto autorizado,
  reconciliado `migration list` y aplicadas individualmente las migraciones
  pendientes revisadas. No se cambia historial previamente aplicado.
- [ ] **E0.2 · Reset reproducible.** Aplicar desde vacío al proyecto de pruebas
  y añadir CI que ejecute migraciones y las pruebas de integración sin secretos
  expuestos en logs.
- [ ] **E0.3 · Seguridad y carreras.** Ampliar RLS a anónimo, tenant/rol/local
  ajeno y Storage; probar carreras de reserva, seating/movimiento, pago, cierre
  e invoice; verificar recuperación tras reintento y doble clic.
- [ ] **E0.4 · Observabilidad/auditoría.** Registro append-only legible para
  reservas, mesas, anulaciones, descuentos, cobros, caja y fiscalidad; runbook
  de backup/restore y recuperación de sesiones abiertas.

**Salida:** CI verde contra Supabase de pruebas, sin acceso cruzado, sin doble
ocupación/cobro/número fiscal y con procedimientos de recuperación ensayados.

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

- [ ] **E2.1 · Flujo público completo.** Calendario real, personas, área,
  contacto, necesidades/alergias, comentarios, condiciones y consentimientos
  separados; antiabuso/rate limit y alternativas por hora/zona/día.
- [ ] **E2.2 · Autogestión segura.** Token con `no-store`, caducidad/rotación y
  políticas para confirmar, modificar o cancelar; no revelar mesas ni PII.
- [ ] **E2.3 · Cliente y privacidad.** Ficha con historial, etiquetas, notas,
  alergias, consentimientos, deduplicación/fusión, exportación/retención según
  G7 y permisos de datos sensibles.

**Salida:** un anónimo reserva y gestiona únicamente su reserva; el host ve su
historial y la agenda actualizada bajo las políticas aprobadas.

### E3 — Catálogo y comandas para TPV (P1)

- [ ] **E3.1 · Catálogo operativo.** Categorías, productos, IVA, precios por
  local/canal, disponibilidad, alérgenos, modificadores y destino cocina/barra.
- [ ] **E3.2 · Comanda.** Añadir/editar/anular cantidades y notas rápidamente,
  congelar precio/modificador/IVA/destino y asociar cada línea a la sesión.
- [ ] **E3.3 · Envío fiable.** Estados enviados/recibidos/preparando/listo/
  entregado, reenvío idempotente, cola offline y auditoría de anulaciones.

**Salida:** camarero completa una comanda desde móvil/tablet sin duplicarla y la
cuenta abierta refleja exactamente las líneas enviadas.

### E4 — Cocina y barra (P1)

- [ ] **E4.1 · Ticket de preparación.** Modelo de batches por estación, cola en
  pantalla, prioridades/notas, cambios de estado y trazabilidad por línea.
- [ ] **E4.2 · KDS accesible.** Pantallas separadas por destino, filtro de turno,
  tiempos de preparación, estados de red y reimpresión segura.

**Salida:** cocina y barra reciben solo sus partidas y sala conoce cuándo están
listas sin comunicación paralela.

### E5 — Cuenta, cobros y documentos (P1)

- [ ] **E5.1 · División y movimientos.** Dividir por persona, importe, producto
  y porcentaje; mover líneas entre sesiones y preservar inmutabilidad/auditoría.
- [ ] **E5.2 · Ajustes controlados.** Descuentos, invitaciones, anulaciones,
  reapertura y correcciones con permiso, motivo y reglas fiscales.
- [ ] **E5.3 · Pago robusto.** Efectivo/tarjeta/transferencia/vale/propina y pago
  mixto idempotentes; devoluciones y conciliación por método.
- [ ] **E5.4 · Salida fiscal.** Ticket/reimpresión, factura simplificada/completa,
  rectificativas y cadena VERI*FACTU test. Activación prod solo tras G5.

**Salida:** una mesa se cobra y documenta correctamente, incluso dividida y con
pagos mixtos, sin sobrecobro ni pérdida de trazabilidad.

### E6 — Caja, terminal e integraciones TPV (P1)

- [x] **E6.1 · Caja.** Apertura, fondo, entradas/salidas, arqueo, diferencia,
  cierre por método, permisos y auditoría.
- [ ] **E6.2 · Sesión de terminal/PIN.** Alta y rotación segura de PIN, límite de
  intentos, terminal identificada y roles de camarero/encargado/admin.
- [ ] **E6.3 · Hardware o alternativa.** Tras G2/G3, bridge local y adaptadores
  para impresora/cajón/datáfono o integración/exportación acordada; instalación
  ensayada por dispositivo.

**Salida:** el cierre de caja concilia con los cobros y cada terminal puede
operar según su rol sin exponer credenciales.

### E7 — Informes y activación del propietario (P1)

- [ ] **E7.1 · Informes mínimos.** Ventas/IVA/método/producto/ticket medio,
  descuentos y cierres por local, día y turno, con exportación compatible.
- [ ] **E7.2 · Onboarding/importación.** Asistente de local, turnos, zonas,
  mesas, carta, impuestos y equipo; importación CSV con preview y errores.
- [ ] **E7.3 · Inventario y producto.** Existencias, movimientos, escandallos,
  alérgenos y precios por canal, según el alcance ampliado documentado.

**Salida:** propietario configura el primer servicio e interpreta los cierres y
ventas sin intervención técnica.

### E8 — Comunicaciones y lista de espera (P2)

- [ ] **E8.1 · Email transaccional.** Plantillas por restaurante/idioma,
  confirmación y recordatorios programados, dedupe, rebotes, reintento y reenvío.
- [ ] **E8.2 · Espera futura.** FIFO compatible, hold/oferta temporal, aceptación
  pública, caducidad y aviso al liberar capacidad, sin sobreventa.
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
  intentos, terminal y sincronización offline idempotente.
- [ ] **E10.3 · Jornada/exportación.** Tramos partidos, cruce de medianoche,
  nocturnidad, festivos, extras/complementarias, cambio de centro, portal y
  exportación para inspección/nóminas.

### E11 — Certificación de entrega (P0 transversal)

- [ ] **E11.1 · E2E y QA.** Smoke: alta → local/plano/carta → reserva → sentar →
  comanda → cocina → cobro → ticket/factura → arqueo/cierre; fichaje y exportación.
- [ ] **E11.2 · Piloto.** Feature flags, formación, datos consentidos, soporte,
  métricas y ensayo de corte de red/multidispositivo.
- [ ] **E11.3 · Cierre.** Checklist de seguridad/fiscal, runbooks, CI, evidencia
  de calidad y aprobación explícita del piloto por restaurante y asesoría.

## Definition of Done del MVP

Solo se marca completo tras un piloto en Supabase no productivo y un servicio de
prueba completo: reserva, sala, comanda, preparación, cobro/ticket, caja/cierre,
fichaje y exportación. Deben quedar demostrados permisos/RLS, offline y
recuperación, deduplicación, auditoría, accesibilidad y los controles de calidad.
