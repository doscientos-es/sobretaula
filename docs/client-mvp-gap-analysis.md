# Análisis de cumplimiento del MVP solicitado por el cliente

Última revisión: 2026-09-10.

Este documento contrasta [`client-mvp-petition.md`](./client-mvp-petition.md), que es la petición del cliente, con el código y las migraciones actuales. `implementation-status.md` describe capacidades internas; este documento añade el criterio de cumplimiento frente al MVP comercial.

## Resumen ejecutivo

El producto tiene una base sólida para tenancy, autenticación, reservas, plano de sala, servicio, cuentas y facturación, pero no cumple todavía el MVP completo descrito por el cliente. Las mayores brechas son: TPV/catálogo operativo, cocina/barra, caja y arqueo, reservas públicas completas, cobros mixtos, informes avanzados y certificación operativa.

El alcance del cliente manda. La hoja de ruta y el diseño se han actualizado
para tratar TPV, escandallos, control horario, caja y cocina, además de
reservas públicas como alcance ampliado del MVP.

## Leyenda

- **Hecho**: existe código funcional y una prueba o evidencia razonable.
- **A medias**: existe una parte relevante, pero falta una pieza necesaria para el flujo solicitado.
- **Pendiente**: no hay implementación suficiente.
- **Bloqueado**: depende de una decisión, proveedor, migración o prueba externa.

## Matriz de cumplimiento

| Área del cliente                              | Estado                                 | Evidencia actual                                                                                                                                                                                                            | Trabajo restante                                                                                                      |
| --------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Catálogo: categorías, productos, precios, IVA | A medias                               | Hay productos/catálogo en la cuenta de mesa y ajustes fiscales/facturación                                                                                                                                                  | Completar CRUD de catálogo, precios por local, IVA por producto, modificadores, disponibilidad y destino cocina/barra |
| Mesas y zonas                                 | Hecho                                  | Plano versionado, zonas, mesas, mover/unir/bloquear, limpieza y sesiones                                                                                                                                                    | Humo real en Supabase y validación con varios usuarios                                                                |
| Comandas                                      | A medias                               | TPV unificado: cuenta por mesa, líneas, notas, estación, estado persistido y altas idempotentes con cola offline                                                                                                            | Añadir edición rápida, reimpresión y trazabilidad operativa                                                           |
| Cocina y barra                                | A medias                               | Cola integrada en TPV, estaciones y líneas con estados `pending/preparing/ready/served/cancelled`; controla doble pulsación y muestra errores                                                                               | Añadir reimpresión y trazabilidad avanzada                                                                            |
| Cobros y facturación del restaurante          | A medias                               | TPV: pagos por método/división, tarjeta manual online, devoluciones y descuentos auditados; responsables controlan ajustes                                                                                                  | Reimpresiones y conciliación completa                                                                                 |
| Caja y arqueo                                 | A medias                               | TPV para responsables: apertura, entradas/salidas, arqueo, diferencia, cierres, histórico y desglose de cobros por método                                                                                                   | Informe financiero completo y conciliación avanzada de devoluciones                                                   |
| Usuarios y permisos del TPV                   | A medias                               | Auth, tenancy, roles y auditoría de plataforma; descuentos auditados; PIN de empleado almacenado solo como hash; verificación server-side y operación de fichaje por terminal con empleado + PIN                            | Roles operativos más finos y revisión final de anulaciones                                                            |
| Informes                                      | A medias                               | Informe de ventas/IVA/método/producto/ticket medio, descuentos y devoluciones integrado en TPV; filtros y exportación CSV                                                                                                   | Cierres de caja e informe financiero completo                                                                         |
| Offline y duplicados                          | A medias                               | Cola offline e idempotencia para reservas, servicio y altas de comandas; cobros de tarjeta se validan online                                                                                                                | Extender a caja, resolver conflictos y recuperación de mesas abiertas                                                 |
| Copias y recuperación                         | A medias                               | Persistencia Supabase y operaciones idempotentes                                                                                                                                                                            | Procedimiento de backup/restore probado y recuperación específica de sesiones/cuentas abiertas                        |
| Hardware                                      | Fuera de alcance actual                | No hay adaptadores de impresora, cajón ni datáfono porque esta fase opera con navegador/tablet y cobro manual                                                                                                               | No se implementa en el MVP actual; reevaluar en una fase posterior si el cliente lo solicita                          |
| VERI*FACTU                                    | A medias/Bloqueado                     | Módulo y modo test preparados                                                                                                                                                                                               | Certificado, validación fiscal, emisión real y aprobación de asesor                                                   |
| Reserva pública sin cuenta                    | A medias                               | Fecha, personas, zona, disponibilidad, contacto, comentario, privacidad, confirmación automática, recordatorio 24 h, enlace de gestión, rate limit por contacto y condiciones versionadas                                   | Validación final, retención/privacidad y evidencia operativa                                                          |
| Disponibilidad y alternativas                 | Hecho en núcleo / A medias en producto | Pacing, best-fit, EXCLUDE y restricciones                                                                                                                                                                                   | Integrar reglas de turno/zona en la UX pública y mostrar alternativas cercanas                                        |
| Gestión diaria de reservas                    | Hecho en núcleo / A medias en UX       | Servicio, agenda, estados, mesas y espera                                                                                                                                                                                   | Completar modos lista/cronología/plano, búsqueda, duplicar/trasladar y acciones de comunicación                       |
| Estados de reserva                            | Hecho                                  | Pendiente, confirmada, llegada, sentada, finalizada/no-show                                                                                                                                                                 | Verificar que cada transición está expuesta en la UX y auditada                                                       |
| Ficha de cliente                              | A medias                               | Clientes, consentimientos, historial de reservas/cancelaciones/no-shows, visitas, gasto, preferencias, alergias, etiquetas y notas internas                                                                                 | Validar retención, exportación, anonimización y permisos de datos sensibles                                           |
| Notificaciones                                | A medias                               | Confirmaciones y recordatorios email 24 h activos mediante outbox/jobs idempotentes                                                                                                                                         | Rebotes, reenvío manual y SMS/WhatsApp requieren proveedor y consentimiento                                           |
| Lista de espera                               | A medias                               | Espera inmediata y futura, estados de oferta/caducidad, aceptación pública y operación desde Servicio                                                                                                                       | Validación de notificaciones y humo de sobreventa                                                                     |
| Configuración de responsables                 | A medias                               | Locales, áreas, horarios y miembros                                                                                                                                                                                         | Turnos, duración, intervalos, antelación, límites por franja, cierres/eventos y permisos de sala                      |
| Control horario                               | A medias                               | Terminal compartido, portal personal, PIN bcrypt, límites de intentos, eventos append-only encadenados, exportación CSV, condiciones laborales, festivos y cálculo indicativo de nocturnidad, jornadas partidas y descansos | Sincronización offline, informes laborales avanzados y validación formal con asesoría                                 |
| Producto: ingredientes y escandallos          | A medias                               | Modelo, CRUD server-side/UI, consulta de coste, versiones históricas y restauración conservadora; carta pública lee atributos                                                                                               | Edición de alérgenos avanzada y presentación pública enriquecida                                                      |
| Carta pública                                 | A medias                               | Ruta pública con RPC protegido y vista específica que muestra productos activos, IVA, precio por canal, veganismo y alérgeno con ingrediente causante                                                                       | Validación visual con datos reales y mejoras de accesibilidad/traducción                                              |
| Inventario                                    | A medias                               | Movimientos por local, stock derivado, descuento/reposición de recetas, consulta de referencias bajo mínimo y primera pantalla por local                                                                                    | Registrar entradas/salidas desde UI, edición de alérgenos/recetas y compras/proveedores                               |
| Facturación SaaS Sobretaula                   | A medias                               | Planes, facturas, webhook, formulario inicial y REST preparado                                                                                                                                                              | Capturar/cifrar token, conectar renovación automática, probar MIT, reintentos y cancelación                           |

## Tareas priorizadas para completar el MVP

### P0 — cerrar el flujo demostrable y la seguridad

1. Revisar y aplicar individualmente las migraciones propias en el único proyecto Supabase autorizado, verificando el esquema sin fixtures, humo, carga ni carreras sobre datos reales.
2. Probar RLS, roles, concurrencia e idempotencia con dos usuarios y dos locales.
3. Conectar el alta Redsys completa y persistir la referencia tokenizada recibida.
4. Completar la pantalla de pago SaaS, retorno OK/KO y estado de suscripción.
5. Añadir smoke end-to-end de: crear restaurante → configurar local → reservar → sentar → abrir cuenta → cobrar → emitir documento.

### P1 — mínimo operativo de TPV

1. Catálogo y modificadores con IVA, disponibilidad y destino.
2. Comandas con notas, envío a cocina/barra y estados de preparación. La persistencia, transición y primera cola operativa ya están implementadas; faltan edición rápida, reimpresión y trazabilidad avanzada.
3. Cuenta dividida, descuentos auditados, pagos mixtos, devoluciones y reimpresión.
4. Caja: apertura, movimientos, arqueo, diferencias y cierre. El núcleo persistente y la UX básica ya están implementados; faltan histórico e informes financieros completos.
5. PIN/roles de terminal y auditoría de acciones críticas.
6. Informes mínimos de ventas, impuestos, productos y cierres.

### P2 — reservas vendibles al cliente final

1. Completar reserva pública sin cuenta y enlace de gestión.
2. Reglas de horarios, turnos, cierres y alternativas.
3. Confirmaciones y recordatorio 24 h ya activos; rate limit por contacto y condiciones versionadas implementados; completar evidencia y retención.
4. Ficha de cliente con alergias, notas, etiquetas, preferencias e historial ya implementada; validar exportación y permisos de datos sensibles.
5. Lista de espera futura con estados y caducidad implementada; completar notificación y humo de sobreventa.

### P3 — control horario y certificación

1. Confirmar requisitos laborales y modelo de exportación con asesoría.
2. Integrar fichaje por PIN en una terminal compartida, con selección de empleado, bloqueo por intentos y registro append-only. Este núcleo, la pantalla, el portal y las protecciones ya están implementados.
3. Completar sincronización offline, informes laborales avanzados, cambios de centro y validación de reglas con asesoría.

## Decisiones que el producto debe cerrar antes de construir

- Confirmar si la entrega será un TPV nativo completo o una integración/exportación temporal, manteniendo ambas dentro del MVP.
- ¿Se requiere operar sin conexión durante todo el servicio o solo tolerar cortes breves?
- ¿Qué proveedor se usará para email, SMS y WhatsApp?
- ¿Qué reglas de IVA, facturación y control horario valida la asesoría?
- ¿La integración Redsys de Sobretaula usa el mismo comercio/terminal que backoffice o una configuración separada?

## Definition of Done del MVP del cliente

No marcar el MVP como completo hasta que exista un piloto controlado con un restaurante que pueda hacer un servicio completo, incluyendo reserva, sala, comanda, preparación, cuenta, cobro, ticket, caja y cierre; y un empleado pueda fichar y consultar/exportar su jornada. Deben quedar demostrados permisos, recuperación, duplicados, auditoría y el despliegue controlado, sin usar datos reales como fixtures de prueba. Hardware de impresión, cajón y datáfono queda fuera de este criterio.
