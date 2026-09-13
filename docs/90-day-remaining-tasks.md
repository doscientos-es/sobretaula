# SobreTaula · Plan técnico de 90 días

Estado: activo. Última revisión: 2026-09-13.

Objetivo: convertir la base actual en un producto vendible y operable para un
restaurante independiente con sala. El alcance termina en un servicio completo
con reserva, sala, TPV, cocina, cobro, caja, fichaje y exportación, con
seguridad, accesibilidad y recuperación demostrables.

Este documento es el backlog ejecutable. Una tarea solo se marca como hecha
cuando tiene código, pruebas proporcionales y evidencia reproducible. Una
migración, una pantalla o un test unitario no equivalen por sí solos a
validación integrada, piloto, aprobación legal ni despliegue remoto.

## Estado de partida y límites

- Ya existe base de tenancy/Auth/roles, plano y servicio, reservas públicas e
  internas, cuenta, TPV, cocina/barra, pagos mixtos, caja, facturación en modo
  test, fichaje, inventario parcial, carta pública, outbox de email y runbook
  de recuperación.
- El checkout real es `internal/projects/sobretaula`; esta carpeta contiene
  documentación de trabajo. No se crean fixtures ni otro proyecto Supabase.
- Hardware de impresión, cajón y datáfono queda fuera. El cobro de tarjeta se
  registra manualmente desde navegador/tablet mientras no se decida una
  integración concreta.
- VERI*FACTU puede operar en pruebas; producción queda bloqueada hasta la
  configuración fiscal, certificado y aprobación de asesoría.
- SMS/WhatsApp no se activan sin proveedor, coste, consentimiento y política
  de privacidad aprobados.

## Calendario de 90 días

### Días 1–7 · Baseline, seguridad y contrato vendible

- Congelar módulos incluidos, roles, límites, precio y claims comerciales;
  reflejarlo en `project-design.md` y el catálogo de módulos.
- Reproducir el flujo en entorno aislado y crear una matriz de journeys: alta,
  primer local, reserva, llegada, mesa, comanda, cocina, cuenta, cobro,
  ticket, limpieza, caja, fichaje y exportación.
- Preparar fixtures anonimizados y `E2E_STORAGE_STATE`; prohibido usar datos
  reales para RLS, concurrencia, carga o humo mutante.
- Auditar RLS de tenant/local/rol, Storage, vistas y funciones; no depender de
  `user_metadata`, comprobar `USING`/`WITH CHECK` y restringir funciones
  privilegiadas.
- Normalizar numeración futura de migraciones y comprobar historial antes de
  aplicar cualquier migración autorizada.

Salida: matriz de riesgos, fixture reproducible, contrato comercial congelado,
CI básica verde y gates externos con propietario y fecha.

### Días 8–14 · Activación del restaurante

- Convertir onboarding en un recorrido único: identidad fiscal, local,
  idioma/zona horaria, roles, zonas, mesas/plano, impuestos, carta, turnos y
  checklist del primer servicio.
- Añadir progreso, dependencias, reanudación, estados vacío/error/offline y
  validación server-side; no publicar reservas si falta capacidad o turnos.
- Terminar importación de productos, modificadores y precios con preview,
  errores por fila, límite de tamaño y persistencia atómica por carga.
- Propagar branding por tenant a reservas, documentos y emails; no convertirlo
  en tema global.

Salida: un owner pasa de cuenta vacía a primer servicio configurado sin ayuda
técnica, conservando evidencia de ruta y permisos.

### Días 15–24 · Reservas internas y públicas

- Cerrar CRUD de turnos, intervalos, duración por grupo, antelación, límites,
  áreas, cierres y bloqueos, con impacto sobre reservas existentes.
- Usar un motor transaccional único para crear, editar, cancelar, asignar,
  recolocar y liberar capacidad; cubrir DST, doble clic, reintentos y
  `operation_id`/dedupe.
- Completar agenda día/semana/turno con lista, cronología y plano; filtros,
  búsqueda y vista persistidos en URL.
- Verificar reserva pública, token, `no-store`, expiración, rate limit,
  condiciones versionadas, cancelación/modificación, lista de espera y email.
- Deshabilitar o guiar el formulario cuando no haya turnos; dar valor accesible
  a “Momento” y no revelar mesas ni PII.

Salida: host gestiona excepciones sin doble reserva; una persona anónima solo
puede reservar y gestionar su propia reserva.

### Días 25–35 · Flujo de sala y cocina

- Hacer reproducible el flujo Ahora: llegadas, retrasos, walk-ins, espera,
  no-show, mesa, traslado/unión, bloqueo, limpieza y handover.
- Cerrar TPV con cuenta, catálogo, modificadores, notas, disponibilidad,
  precios/IVA/destino congelados y anulaciones auditadas.
- Completar KDS por estación: batches, prioridad, estados, tiempos,
  reimpresión web con permiso y trazabilidad por línea; reintentos sin duplicar.
- Verificar realtime, estado de red, cola offline visible y recuperación de
  sesión; operaciones que requieren estado actual siguen online.
- Corregir boundaries: mensaje operativo, ID de soporte, reintento, carga y sin
  permiso; nunca exponer JSON de Zod.

Salida: sala sabe qué está listo, bloqueado, pendiente de limpiar o requiere
atención.

### Días 36–46 · Cuenta, cobro, caja y documentos

- Aplicar tras revisión la migración de asignación de líneas a pagos; validar
  división por persona/producto/porcentaje/importe y movimientos entre sesiones.
- Cerrar descuentos, invitaciones, anulaciones, reapertura y correcciones con
  permiso, motivo, límites fiscales y auditoría.
- Verificar efectivo, tarjeta manual, transferencia, vale, propina, pagos
  mixtos, devoluciones, idempotencia y conciliación por método.
- Verificar apertura/fondo, entradas/salidas, arqueo, diferencia, cierre,
  reimpresión web y factura simplificada/completa/rectificativa.
- Mantener VERI*FACTU en test; probar certificado, adaptador, outbox, reintento
  y cadena sin secretos en cliente.

Salida: una mesa se cobra y documenta una sola vez; caja concilia y cada
corrección deja rastro.

### Días 47–57 · Fichaje, propinas, privacidad y exportaciones

- Verificar terminal/PIN, pausas, cambios de centro, offline personal, límites
  de intentos, eventos inmutables y portal individual.
- Cerrar bote diario y periodos flexibles: total contado al final del día,
  participantes, minutos trabajados, reparto proporcional, redondeo explicado
  y ajustes auditados.
- Implementar CSV/JSON consistentes para ventas, caja, pagos, facturas,
  fichajes, propinas, reservas y clientes; incluir versión, zona horaria,
  filtros, encabezados estables y permisos.
- Definir retención, anonimización y acceso a alergias/notas; separar operación
  de marketing. Validar formatos con gestoría y asesoría laboral.

Salida: owner/manager descarga un paquete interpretable, sujeto a aprobación
externa de formato y conservación.

### Días 58–68 · Robustez, accesibilidad y observabilidad

- Suite aislada de RLS por tenant, local, rol, anónimo y Storage; carreras de
  reserva, mesa, comanda, pago, caja, factura y fichaje.
- Revisar índices y consultas críticas con medición; ejecutar advisors y
  comprobar `security_invoker` en vistas cuando aplique.
- Pruebas WCAG 2.2 AA: teclado, foco, lector de pantalla, contraste, targets,
  zoom, reduced motion y no depender del color, en móvil y tablet.
- Añadir loading/empty/error/offline/sin permiso en módulos críticos; quitar
  navegación duplicada de escritorio y conservar lista accesible del plano.
- Completar auditoría legible, correlación de operaciones, health/readiness,
  alertas de outbox y runbook de backup/restore; ejecutar restore autorizado.

Salida: fallos reproducibles, recuperables y atribuibles, sin pruebas de
seguridad sobre datos reales.

### Días 69–80 · Piloto controlado y certificación local

- Preparar tenant piloto separado, datos del restaurante y formación de owner,
  jefe de sala, camarero y cocina.
- Ejecutar shadow mode y dos servicios controlados; medir tiempos, incidencias,
  doble cobro, pérdida de comanda, reserva duplicada, arqueo, exportación y
  accesibilidad.
- Recoger aceptación por journey con severidad P0/P1/P2; repetir cada caso
  corregido antes de considerarlo validado.
- Preparar expediente de certificación local: identidad fiscal, dirección,
  series, certificado digital, adaptador fiscal, responsable, cierre y soporte.
  La aprobación pertenece al restaurante y su asesoría, no al test local.

Salida: acta de piloto, incidencias críticas cerradas o bloqueadas
explícitamente y expediente listo para revisión externa.

### Días 81–90 · Release candidate y decisión de venta

- Repetir smoke E2E completo y guardar logs, capturas, exportaciones, IDs de
  operación y resultados de accesibilidad.
- Ejecutar `pnpm quality`, `pnpm build`, tests unitarios/integración y E2E
  autenticado; verificar rutas, idiomas, emails, 404, permisos y `no-store`.
- Verificar Preview y producción solo con autorización, migración revisada y
  evidencia remota; un build local no es un release.
- Publicar límites: hardware fuera, VERI*FACTU test/prod, mensajería, soporte,
  recuperación y formato de exportación.
- Decidir `GO`, `GO limitado` o `NO-GO` según la matriz de gates.

Salida: release candidate vendible para el segmento definido, con pendientes
externos y rollback/soporte documentados.

## Matriz de gates y evidencias

| Gate | Tipo    | Requisito                                      | Evidencia de cierre               | Bloquea           |
| ---- | ------- | ---------------------------------------------- | --------------------------------- | ----------------- |
| I1   | Interno | Activación y carta/turnos configurables        | E2E aislado + artefactos          | Piloto            |
| I2   | Interno | Reserva-sala-TPV-cocina-caja-fichaje           | Smoke sin duplicados              | Venta limitada    |
| I3   | Interno | RLS, idempotencia, auditoría y restore         | Suite aislada + restore           | Datos reales      |
| I4   | Interno | Exportaciones y accesibilidad                  | Fixtures, CSV/JSON, revisión AA   | Piloto            |
| X1   | Externo | Asesoría fiscal: IVA, series, VERI*FACTU, AEAT | Aprobación escrita                | Fiscalidad prod   |
| X2   | Externo | Asesoría laboral: jornada y conservación       | Criterio escrito                  | Fichaje comercial |
| X3   | Externo | Privacidad, retención y anonimización          | Política aprobada/publicada       | Escala            |
| X4   | Externo | Piloto independiente                           | Acta de dos servicios             | GO general        |
| X5   | Externo | Supabase remoto autorizado                     | Migraciones, RLS y logs remotos   | Producción        |
| X6   | Externo | Proveedor + consentimiento SMS/WhatsApp        | Configuración + entrega           | SMS/WhatsApp      |
| X7   | Externo | Certificación local del restaurante            | Fiscal, certificado y responsable | VERI*FACTU prod   |

Los gates X no se cierran con mocks, tests locales, una Preview, una migración
existente ni una pantalla funcional. Si falla uno, queda `bloqueado` con causa,
propietario y siguiente acción; no se rebaja silenciosamente el alcance.

## Backlog priorizado

- [~] **P0.1 Activación:** onboarding base y equipo disponibles; falta recorrido
  único con turnos, zonas, carta, impuestos y primer servicio.
- [~] **P0.2 Reservas internas:** CRUD de turnos y agenda con búsqueda, estado,
  reprogramación, historial, filtros persistidos en URL e idempotencia de
  creación preparados; faltan bloques con impacto, reglas por área, cerrar
  todas las transiciones en un motor único y validar concurrencia remotamente.
- [ ] **P0.3 Flujo diario:** smoke reserva → sala → TPV → cocina → cobro → caja.
- [ ] **P0.4 Seguridad:** RLS, carreras, idempotencia, auditoría y restore aislado.
- [ ] **P1.1 Sala/cocina:** Ahora, KDS completo, handover y tablet/móvil.
- [~] **P1.2 Cuenta/caja:** dominio preparado; falta migración autorizada y humo.
- [ ] **P1.3 Fichaje/propinas:** cierre laboral, reparto por tiempo y exportación.
- [ ] **P1.4 Fiscalidad:** VERI*FACTU E2E en test; prod solo tras X1/X7.
- [ ] **P1.5 Privacidad/exportaciones:** retención, anonimización y formatos.
- [~] **P2.1 Importación:** CSV con productos y modificadores, preview, errores por
  fila y RPC atómico preparados; falta aplicar la migración y prueba integrada.
- [~] **P2.2 Reserva pública:** flujo y emails implementados; faltan humo,
  retención/privacidad y validación remota.
- [ ] **P2.3 Comunicaciones:** rebotes y reenvío manual; SMS/WhatsApp tras X6.

## Definition of Done

El plan termina cuando un restaurante piloto completa dos servicios controlados
desde la reserva hasta el cierre de caja, fichaje y exportación, sin P0/P1
abiertos, con permisos y auditoría demostrados, accesibilidad revisada,
recuperación ensayada y gates externos registrados por separado. La aprobación
fiscal, laboral, de privacidad, del piloto y del Supabase remoto debe figurar
como evidencia independiente.
