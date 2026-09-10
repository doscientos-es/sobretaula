# Plan maestro · Planificador de sala de Sobretaula

Estado: activo · Inicio: 2026-09-10

Este es el plan vivo solicitado para convertir Sobretaula en el planificador de
sala más claro y útil para restaurantes con varias zonas, pisos y terrazas.
Se ejecuta sobre el trabajo existente de `features/floor-plan`; no se duplica
la hoja de ruta operativa de reservas y servicio, sino que concreta la calidad
del diseñador y su uso diario.

## Norte de producto

- El admin puede crear o modificar un plano sin formación técnica.
- El jefe de sala entiende en menos de cinco segundos qué está pasando.
- Un camarero puede actuar desde móvil o tablet con una mano.
- Ningún cambio destruye reservas, cuentas, histórico o seguridad.

## Alcance por entregas

### P0 · Base fiable (en curso)

- [x] Revisar modelo y editor SVG existentes.
- [x] Mantener borrador, versión activa e historial.
- [x] Validar dimensiones, límites y solapes antes de publicar.
- [x] Detectar conflictos entre layouts temporales.
- [x] Añadir pisos, zonas y tipo de espacio (interior, terraza cubierta,
      terraza exterior), incluyendo el estado operativo de terrazas.
- [ ] Documentar estados de carga, error, vacío, permisos y red inestable.

### P1 · Diseñador visual v1

- [x] Biblioteca de elementos: mesa, pared, puerta, barra, pilar, escalera,
      baño, cocina, salida, ventana, obstáculo y etiqueta.
- [x] Selección múltiple, duplicado, alineación por los cuatro bordes y distribución
      horizontal/vertical ya disponibles; bloqueo local disponible; agrupación y
      persistencia de bloqueo siguen pendientes.
- [x] Zoom/pan y guías de alineación: zoom accesible, pan con Alt+flechas,
      cuadrícula configurable de 25 cm/50 cm/1 m, snap sincronizado y ejes del
      elemento seleccionado.
- [x] Propiedades de elemento en panel lateral y numeración automática segura.
- [x] Validación visual de solapes, límites y salidas bloqueadas; los pasillos
      quedan para P2.
- [ ] Previsualización tablet/móvil y publicación programada.
- [x] Selección, duplicado, eliminación y edición de propiedades.

### P2 · Operación de turno

- [x] Plano en vivo y vista lista intercambiables.
- [x] Estados de mesa con color + icono + texto, nunca solo color.
- [ ] Acciones rápidas: sentar, liberar, limpiar, bloquear, nota y asignar.
- [x] Pisos/zonas filtrables y vista global para encargados.
- [ ] Combinar/separar mesas preservando reservas y cuentas.
- [x] Combinar/mover sesiones con validación de ocupación y capacidad en servidor.
- [x] Filtrado por zona/planta y resumen de ocupación.
- [x] Preflight de capacidad para grupos grandes.
- [x] Sugerencia automática de combinación libre más ajustada por capacidad.
- [x] Acción para seleccionar la combinación sugerida desde el panel operativo.
- [x] Realtime para reservas, asignaciones y sesiones, aviso de modo degradado
      y bloqueo de mutaciones sin conexión.
- [~] Conectar la cola persistente local: `seatReservation` ya guarda
  operaciones offline, las reintenta al volver la conexión y usa
  `operation_id` único en `table_sessions` para no duplicar sesiones.
  Extender el adaptador a walk-ins, movimientos y lista de espera requiere
  idempotencia específica por operación.

### P3 · Inteligencia y casos avanzados

- [ ] Recomendación de mesa por capacidad, zona, accesibilidad y próxima
      reserva.
- [ ] Layouts temporales para eventos, temporada y cierre de terraza.
- [ ] Reglas meteorológicas y traslado terraza ↔ interior.
- [ ] Pacing, cronómetros, secciones de camareros y handover de turno.
- [ ] Importación desde imagen/PDF y plantillas reutilizables.

## Edge cases obligatorios

Solapes, puertas o salidas bloqueadas, mesa eliminada con reservas futuras,
cambio concurrente, pérdida de red, dispositivo con datos antiguos, terraza
cerrada inesperadamente, mesa combinada con clientes sentados, cambio de
numeración, layouts que cruzan medianoche y permisos por piso/zona.

## Definition of Done

Cada entrega debe tener pruebas de dominio y de interacción, estados de carga,
vacío, error y permiso, responsive para su dispositivo objetivo, teclado/foco,
contraste WCAG 2.2 AA, auditoría de mutaciones y verificación contra Supabase
de pruebas cuando exista el entorno dedicado.

## Métricas

Tiempo para crear el primer plano, tiempo para modificar una mesa, errores de
asignación, tiempo de liberación a disponibilidad, adopción del plano durante
el servicio y latencia de sincronización.

## Siguiente trabajo ejecutable

1. Extraer el lienzo en componentes accesibles y añadir selección múltiple.
2. Completar validación visual de pasillos y salidas bloqueadas.
3. Añadir sincronización realtime, reintentos idempotentes y modo degradado.
4. Cubrir validaciones de layout con pruebas unitarias y de UI.
5. Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.
6. Conectar `table_group_presets` con el diseñador y servicio: guardar, aplicar y
   separar combinaciones con preflight de reservas, cuentas y capacidad.
   La normalización local de nombres, IDs y capacidad ya está cubierta por
   pruebas de dominio.
   La decisión de persistencia de pisos y terrazas está documentada en
   [`adr/0008-pisos-y-terrazas.md`](./adr/0008-pisos-y-terrazas.md).
