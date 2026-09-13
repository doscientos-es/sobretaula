# SobreTaula · Tareas restantes del plan de 90 días

Última revisión: 2026-09-13.

Este es el backlog ejecutable restante para convertir la base actual en un
producto vendible para restaurantes independientes con sala. Una tarea solo se
marca como completada cuando tiene código, pruebas proporcionales y evidencia
reproducible. La validación externa, los pilotos y la operación sobre el
proyecto Supabase autorizado no se pueden sustituir por tests locales.

## Orden de ejecución

### P0 · Producto demostrable y seguro

- [~] **P0.1 · Activación del local.** El onboarding cubre identidad fiscal,
  local, idioma y zona horaria; la gestión de equipo durante la preparación
  también está disponible. Falta cerrar turnos, zonas, carta, impuestos y
  checklist de primer servicio en un único recorrido.
- [ ] **P0.2 · Reservas internas.** CRUD de turnos y reglas, duración por
      grupo, límites por intervalo, cierres/bloques con impacto y agenda con
      filtros persistidos en URL.
- [ ] **P0.3 · Flujo único de servicio.** Smoke reproducible de reserva,
      llegada, mesa, comanda, cocina, cuenta, cobro, limpieza y caja.
- [ ] **P0.4 · Seguridad verificable.** Suite aislada para RLS por tenant,
      local y rol; carreras e idempotencia de reservas, mesas, comandas, pagos y
      cierres; nunca contra datos reales.
- [ ] **P0.5 · Operación observable.** Auditoría legible, estados de red,
      cola offline visible, recuperación de sesión y runbook de backup/restore.
      El runbook está documentado en `docs/operational-recovery-runbook.md`;
      faltan ejecutar el restore y guardar evidencia en un entorno autorizado.

### P1 · Ventaja de sala

- [ ] **P1.1 · Vista Ahora.** Llegadas, retrasos, walk-ins, espera, mesas que
      requieren atención, limpieza, bloqueos y carga de cocina en una prioridad
      accionable.
- [ ] **P1.2 · KDS completo.** Batches por estación, prioridades, reimpresión
      web segura, estados de preparación y trazabilidad por línea.
- [ ] **P1.3 · Handover operativo.** Entrega viva e histórica por área,
      diferencias respecto a la entrega anterior y uso medible.
- [ ] **P1.4 · Experiencia tablet/móvil.** Prueba de teclado, foco, contraste,
      objetivos táctiles y estados de carga/error/offline en los flujos críticos.

### P1 · Economía, fiscalidad y equipo

- [ ] **P1.5 · Cuenta completa.** División por persona/producto/porcentaje/
      importe, movimientos entre sesiones y reapertura controlada. El dominio,
      la UI y la integración con `record_single_payment_with_allocations` están
      preparados; falta aplicar la migración autorizada, validar la semántica
      de reparto en base de datos y ejecutar el flujo integrado con datos de
      prueba.
- [ ] **P1.6 · Caja y exportaciones.** Validación contable del arqueo, informe
      para gestoría y exportación de jornada.
- [ ] **P1.7 · Propinas y coste laboral.** Reglas por local, cálculo por tiempo
      trabajado, redondeo explicado y resumen semanal accionable.
- [ ] **P1.8 · Fiscalidad.** VERI*FACTU extremo a extremo, errores accionables,
      certificados y aprobación de asesoría antes de activar producción.
- [ ] **P1.9 · Privacidad laboral y clientes.** Retención, anonimización,
      exportación, permisos de datos sensibles y formato de inspección.

### P2 · Activación comercial y ecosistema

- [~] **P2.1 · Importación.** Clientes y reservas ya tienen CSV con preview,
  validación y errores por fila; faltan productos/categorías/modificadores y
  la importación transaccional completa.
- [~] **P2.2 · Reserva pública vendible.** Reserva, gestión por token,
  `no-store`, caducidad, rate limit, condiciones versionadas y lista de
  espera están implementados; falta humo de sobreventa y validación de
  retención/privacidad.
- [~] **P2.3 · Comunicaciones.** Confirmaciones y recordatorios por email están
  activos mediante outbox/worker; faltan rebotes y reenvío manual. SMS/WhatsApp
  siguen desactivados hasta aprobar proveedor y consentimiento.
- [~] **P2.4 · Integraciones mínimas.** Hay carta pública, checkout de pedidos
  online y contratos de pago; faltan exportación contable, widget/canales
  externos y validación con los pilotos.
- [ ] **P2.5 · Pilotos de pago.** Tres restaurantes independientes, diez
      servicios observados por restaurante, formación, soporte, métricas y
      conversión a pago.

## Gates que no puede cerrar el código por sí solo

- Asesoría fiscal para VERI*FACTU.
- Asesoría laboral para jornada, conservación y exportación.
- Política aprobada de privacidad/retención/anonimización.
- Entorno seguro separado para RLS, carreras y smoke.
- Proveedor y consentimiento de SMS/WhatsApp.
- Tres restaurantes piloto y evidencia de uso real.

## Definición de terminado

El plan de 90 días queda terminado cuando un restaurante piloto puede completar
un servicio completo desde SobreTaula, incluyendo reserva, sala, comanda,
preparación, cobro, ticket, caja, cierre, fichaje y exportación, con permisos,
auditoría, recuperación y accesibilidad demostrados. No se incluyen hardware
propio ni un marketplace de reservas.
