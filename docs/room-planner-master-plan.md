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
- [x] Documentar estados de carga, error, vacío, permisos y red inestable.

#### Contrato de estados del diseñador y la vista operativa

Estos estados son parte del producto, no mensajes genéricos de infraestructura.
Cada uno debe conservar el contexto (piso/zona seleccionados), explicar la
acción siguiente y evitar mutaciones ambiguas:

| Estado                | Comportamiento exigido                                                                                                                 | Criterio de aceptación                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cargando              | Esqueleto del lienzo/panel, sin controles que parezcan editables; anunciarlo a lectores de pantalla.                                   | Nunca aparece un lienzo vacío durante una carga válida ni se pierde el filtro activo.                         |
| Vacío                 | CTA contextual para crear el primer piso/zona o importar una plantilla; explicar que aún no hay mesas.                                 | Un admin puede llegar al primer elemento en un paso y un trabajador ve claramente “sin servicio configurado”. |
| Error recuperable     | Mantener la última instantánea válida en modo lectura, mostrar causa y botón Reintentar; no borrar borradores locales.                 | Un fallo de red/API no destruye cambios ni deja botones de publicar habilitados.                              |
| Sin permisos          | Ocultar mutaciones (crear, mover, publicar, bloquear) y explicar el rol requerido; permitir lectura si la política lo permite.         | Teclado, menú contextual y atajos tampoco pueden mutar el plano.                                              |
| Red inestable/offline | Banner persistente con hora de última sincronización, cola pendiente y estado degradado; acciones no soportadas quedan deshabilitadas. | Al reconectar se reintenta de forma idempotente y el usuario puede revisar conflictos antes de publicar.      |
| Conflicto concurrente | Congelar la publicación, comparar versión local/remota y ofrecer recargar, duplicar como borrador o resolver.                          | Nunca se sobreescribe silenciosamente un plano publicado por otra persona.                                    |

Los estados deben probarse en escritorio, tablet y móvil, con foco visible,
`aria-live` para cambios de red/error y contraste WCAG 2.2 AA.

### P1 · Diseñador visual v1

- [x] Biblioteca de elementos: mesa, pared, puerta, barra, pilar, escalera,
      baño, cocina, salida, ventana, obstáculo y etiqueta.
- [x] Selección múltiple, duplicado, alineación por los cuatro bordes y distribución
      horizontal/vertical ya disponibles; bloqueo local disponible; agrupación y
      persistencia de bloqueo ya se guarda en la colocación al publicar una
      versión; se mantiene además el fallback local durante la migración.
- [x] Zoom/pan y guías de alineación: zoom accesible, pan con Alt+flechas,
      cuadrícula configurable de 25 cm/50 cm/1 m, snap sincronizado y ejes del
      elemento seleccionado.
- [x] Propiedades de elemento en panel lateral y numeración automática segura.
- [x] Validación visual de solapes, límites, salidas bloqueadas y pasillos
      configurables (75 cm, 90 cm o 1,2 m) antes de publicar.
- [x] Previsualización tablet/móvil en el lienzo (escritorio, tablet y móvil).
- [x] Publicación programada con inicio y fin opcional de vigencia.
- [x] Selección, duplicado, eliminación y edición de propiedades.

### P2 · Operación de turno

- [x] Plano en vivo y vista lista intercambiables.
- [x] Estados de mesa con color + icono + texto, nunca solo color.
- [~] Acciones rápidas: sentar/liberar/cerrar cuenta, walk-in, limpiar y bloquear/reabrir
  mesas disponibles; la
  nota interna de sesión ya se puede guardar desde el panel. Limpiar y
  asignar trabajadores por sección ya están disponibles. El bloqueo exige
  motivo, rechaza mesas ocupadas y queda fuera de sugerencias/seating; el
  cierre marca las mesas como pendientes de limpieza hasta confirmación.

Contrato de acciones rápidas: `sentar` sólo desde libre/reservada, `liberar`
sólo desde ocupada, `limpiar` desde ocupada o pendiente de limpieza,
`bloquear` requiere motivo y oculta la mesa del seating, `nota` no cambia el
estado y `asignar` exige trabajador activo. Todas deben validar la versión de
la mesa, usar `operation_id` idempotente, registrar actor/motivo y mostrar
confirmación reversible; sin conexión sólo se encolan las transiciones
seguras y se bloquean las que puedan perder una reserva o cuenta.

- [x] Pisos/zonas filtrables y vista global para encargados.
- [~] Combinar/separar mesas: unir cuentas existentes y separar una selección
  en una nueva sesión cuando todavía no hay comandas ni pagos; las reservas
  no se separan silenciosamente y la operación queda auditada por el actor.
- [x] Combinar/mover sesiones con validación de ocupación y capacidad en servidor.
- [x] Filtrado por zona/planta y resumen de ocupación.
- [x] Preflight de capacidad para grupos grandes.
- [x] Sugerencia automática de combinación libre más ajustada por capacidad.
- [x] Acción para seleccionar la combinación sugerida desde el panel operativo.
- [x] Realtime para reservas, asignaciones y sesiones, aviso de modo degradado
      y bloqueo de mutaciones sin conexión.
- [~] Conectar la cola persistente local: `seatReservation` ya guarda
  operaciones offline, las reintenta al volver la conexión y usa
  `operation_id` único en `table_sessions` para no duplicar sesiones. El
  mismo adaptador cubre ya walk-ins y sentar una espera. Extenderlo a
  movimientos, uniones y cancelaciones ya tienen marca de última operación
  en servidor y pasan por el mismo encolado de navegador.

### P3 · Inteligencia y casos avanzados

- [~] Recomendación de mesa por capacidad, zona y accesibilidad; las mesas
  reservadas muestran ahora la proximidad de la próxima reserva y el motor
  protege mesas libres con llegadas dentro del margen configurable. Queda
  preferencias explícitas del cliente (zona preferida ya pondera empates) y
  carga de cocina del turno (también pondera empates); la carga de sesiones
  abiertas por zona ya se usa como desempate cuando no se ha fijado una sección.
- [~] Layouts temporales: las versiones admiten inicio y fin de vigencia,
  validan solapes y se pueden programar desde el editor; las plantillas de
  evento ya tienen contrato y detección de conflictos por área. Queda el CRUD
  visual y un CTA específico para cerrar una terraza.
- [~] Reglas meteorológicas y traslado terraza ↔ interior: la política, el
  contrato de proveedor y el adaptador Open-Meteo ya están aislados; falta
  aplicar el plan como operación transaccional sobre reservas/sesiones. El
  cierre de terraza ya bloquea de forma determinista si hay sesiones o reservas.
- [~] Secciones de camareros: cada área puede tener varios miembros activos
  asignados y se puede editar desde Servicio; el panel ya muestra pacing,
  cronómetros y un handover estructurado por sección. La entrega se puede
  guardar con responsable y fecha y consultar sus diez últimas instantáneas,
  abrir el detalle de cada sección y ver los cambios frente al estado vivo,
  con filtro rápido por fecha. El objetivo de pacing ya es configurable por
  local (15–360 minutos) y el handover muestra una alerta objetiva de cocina
  basada en comandas recientes. La carta ya conserva la estación de cada línea
  (`general`, `hot`, `cold`, `bar`, `dessert`) y minutos de preparación
  configurables desde la carta; el handover ya desglosa la carga de
  líneas recientes ponderadas por minutos y alerta por estación cuando supera
  el umbral configurable del local.
- [~] Importación desde imagen/PDF y plantillas reutilizables: existe formato
  JSON versionado, validación, exportación y selector/importador visual; queda
  la extracción asistida desde imagen/PDF. El contrato de parser ya exige
  revisión manual cuando no hay OCR/vectorización disponible.

## Edge cases obligatorios

Solapes, puertas o salidas bloqueadas, mesa eliminada con reservas futuras,
cambio concurrente, pérdida de red, dispositivo con datos antiguos, terraza
cerrada inesperadamente, mesa combinada con clientes sentados, cambio de
numeración, layouts que cruzan medianoche y permisos por piso/zona.

### Estados de interfaz acordados

Todas las vistas operativas deben mostrar una señal textual para carga, error,
vacío, permisos insuficientes y pérdida de red. Las mutaciones quedan
deshabilitadas sin conexión cuando no existe una operación idempotente; las que
sí tienen cola local muestran confirmación de guardado y se reintentan al
reconectar. El plano mantiene además una alternativa de lista accesible para
teclado y lectores de pantalla.

## Definition of Done

Cada entrega debe tener pruebas de dominio y de interacción, estados de carga,
vacío, error y permiso, responsive para su dispositivo objetivo, teclado/foco,
contraste WCAG 2.2 AA, auditoría de mutaciones y verificación del esquema activo
sin ejecutar datos de prueba contra el proyecto con datos reales.

## Métricas

Tiempo para crear el primer plano, tiempo para modificar una mesa, errores de
asignación, tiempo de liberación a disponibilidad, adopción del plano durante
el servicio y latencia de sincronización.

## Siguiente trabajo ejecutable

1. Extraer el lienzo en componentes accesibles y añadir selección múltiple.
2. Completar la separación de sesiones con cuenta activa mediante distribución
   explícita de productos y pagos, preservando reservas y trazabilidad.
3. Añadir sincronización realtime, reintentos idempotentes y modo degradado.
4. Cubrir validaciones de layout con pruebas unitarias y de UI.
5. Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.
6. Conectar `table_group_presets` con el diseñador y servicio: el loader del
   plano devuelve presets, se pueden guardar desde la selección y aplicar de
   nuevo desde la lista accesible, o eliminarlos con confirmación. Queda el
   preflight de reservas, cuentas y capacidad antes de separar o usar una
   combinación en servicio; Servicio ya carga los presets y deshabilita los que
   están obsoletos, ocupados o superan su capacidad máxima. La
   normalización local de nombres, IDs y capacidad ya está cubierta por pruebas
   de dominio.
   La decisión de persistencia de pisos y terrazas está documentada en
   [`adr/0008-pisos-y-terrazas.md`](./adr/0008-pisos-y-terrazas.md).
