# Plan de evolución UX/UI SaaS — 2026-09-13

## Propósito y resultado objetivo

SobreTaula debe sentirse como una herramienta profesional para la operación diaria de un restaurante: rápida de leer bajo presión, predecible al ejecutar una acción y tranquilizadora cuando la red o los datos fallan. El objetivo no es rediseñar por estética, sino aumentar la claridad operativa, reducir errores y reforzar la percepción de producto SaaS maduro.

Principios que guían todas las entregas:

1. **Operativa antes que ornamentación:** la mesa, la reserva, la cuenta y el siguiente paso tienen prioridad visual.
2. **Estado siempre explícito:** carga, sincronización, éxito, error, vacío, bloqueo y modo offline deben ser visibles y accionables.
3. **Una acción, una respuesta:** cada interacción debe tener respuesta en menos de 100 ms, estado pendiente cuando aplica y confirmación o recuperación al terminar.
4. **Diseño inclusivo por defecto:** foco inequívoco, contraste AA, objetivos táctiles de 44 px, semántica correcta y respeto a `prefers-reduced-motion`.
5. **Consistencia entre producto y administración:** mismo lenguaje de superficies, controles, estados y densidad; no necesariamente la misma composición.
6. **Cambios reversibles y medibles:** primero mejoras en componentes compartidos y rutas críticas; ningún cambio visual debe alterar permisos, datos o reglas de negocio.

## Lectura del estado actual

### Fortalezas verificadas

- Sistema de tokens propio sobre `@doscientos/ui`, tipografía consistente, superficies sobrias y marca reconocible.
- Shell responsive con sidebar en escritorio, drawer accesible y navegación compacta en móvil.
- Estados de carga compartidos, boundaries de error con reintento y estados vacíos en los flujos públicos principales.
- Feedback de formularios mediante `useFormFeedback`, soporte de sincronización/realtime en Servicio y semántica `aria-live` en puntos importantes.
- Las pruebas E2E no mutantes ya cubren navegación crítica y el acceso móvil.

### Riesgos y oportunidades

| Prioridad | Área                | Hallazgo                                                                                            | Impacto                                            | Dirección                                                                       |
| --------- | ------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| P0        | Acciones operativas | Algunas mutaciones no pasan a pendiente ni confirman éxito; podía repetirse un clic.                | Doble operación y baja confianza.                  | Patrón único de estado de acción, bloqueo e idempotencia visual.                |
| P1        | Movimiento y foco   | Las transiciones y focos no están normalizados para todos los controles/superficies.                | Interfaz menos cohesionada y peor uso con teclado. | Tokens de duración/easing, `focus-visible` y reduced motion globales.           |
| P1        | TPV y Servicio      | Métricas, acciones y avisos compiten visualmente en pantallas de alta presión.                      | Lectura lenta y mayor carga cognitiva.             | Jerarquía por prioridad operacional, color semántico y agrupación por decisión. |
| P1        | Listas de dominio   | La paginación, búsqueda y filtros explícitos siguen pendientes en varios módulos.                   | Rendimiento y encontrabilidad empeoran al crecer.  | Filtros en URL, cursor servidor, contador y estados de resultado.               |
| P2        | Navegación          | Sidebar y administración duplican estilos que pueden divergir.                                      | Deuda visual y mantenimiento caro.                 | Primitivas compartidas para navegación, cabecera y workspace.                   |
| P2        | Onboarding          | La activación guía pasos, pero falta un progreso transversal y ayuda contextual por módulo.         | Tiempo hasta primer valor mayor.                   | Checklist persistente, hitos y acciones guiadas.                                |
| P2        | Público             | La reserva es visualmente cuidada, pero puede mejorar el feedback de disponibilidad y confirmación. | Más abandono ante incertidumbre.                   | Resumen persistente, selección de franja clara y confirmación reforzada.        |

## Plan de ejecución por fases

### Fase 0 — Base de calidad y medición (1–2 días)

- Inventariar rutas, roles, acciones mutantes, estados vacíos y variantes de feedback en una matriz UX.
- Definir eventos de producto no sensibles: apertura de módulo, primer valor, error recuperable, intento/success de acción y abandono de reserva.
- Establecer línea base: éxito de reservas, tiempo hasta primera configuración, errores por sesión, uso móvil y acciones repetidas.
- Crear una checklist de revisión por PR: contraste, teclado, loading/error/empty/success, móvil 320–390 px y reduced motion.
- Criterio de salida: cada flujo crítico tiene propietario, evento de éxito y estado de feedback definido.

### Fase 1 — Lenguaje visual y microinteracciones (3–5 días)

- Consolidar tokens semánticos de canvas, superficie, borde, foco, éxito, aviso, peligro y estados interactivos; eliminar valores repetidos gradualmente.
- Normalizar tiempos: 120–160 ms para controles, 180–220 ms para tarjetas/paneles y sin transformaciones largas en operación.
- Aplicar estados `hover`, `active`, `focus-visible` y `disabled` coherentes en enlaces-card, botones secundarios, filas y pestañas.
- Aplicar `prefers-reduced-motion` global a animaciones, scroll y transformaciones no esenciales.
- Establecer patrón de feedback: botón pendiente + mensaje cercano `aria-live` + cambio de datos + confirmación breve; los errores deben proponer recuperación.
- Criterio de salida: componentes compartidos cubren interacción de ratón, teclado, táctil y reduced motion sin cambiar la semántica.

### Fase 2 — Flujos de máxima frecuencia (1 semana)

#### Servicio y plano

- Priorizar visualmente alertas que bloquean acciones (offline, datos obsoletos, cocina saturada) sobre información secundaria.
- Hacer más distinguibles los estados de mesa mediante color, texto/icono y no solo color; añadir leyenda compacta y selección visible.
- Confirmar las mutaciones de mesa en contexto y ofrecer deshacer solo donde sea técnicamente seguro e idempotente.
- Dar feedback de realtime: “sincronizado”, “actualizando” y “sin conexión”; evitar alarmismo cuando exista cola offline segura.

#### TPV, cuenta y cobro

- Convertir métricas y accesos rápidos en bloques escaneables, con señal clara de qué requiere atención.
- Mantener una acción primaria por panel y acciones destructivas separadas visualmente, con confirmación contextual.
- Añadir estados optimistas solo a cambios reversibles; para cobros, mostrar pendiente inequívoco y resultado inmutable con referencia de operación.
- Mantener totales, impuestos y método de pago visibles durante todo el proceso de cobro.

#### Reservas y espera

- Reforzar agenda con loading inicial, pendiente, éxito y prevención de doble envío (entregado parcialmente en este ciclo).
- Incorporar filtros guardables en URL y resumen de resultados; diferenciar “sin reservas” de “no se han podido cargar”.
- Usar badges semánticos consistentes para pendiente, confirmada, sentada, cancelada, no-show y depósitos.
- Criterio de salida: todas las acciones críticas tienen feedback y las vistas permiten decidir en menos de una exploración vertical.

### Fase 3 — Configuración y primer valor (1 semana)

- Crear una ruta de activación basada en dependencias reales: datos fiscales, método de pago, local, plano, carta, turnos y primera reserva.
- Mostrar el progreso persistente sin bloquear módulos que ya aportan valor; cada tarea enlaza directamente al lugar de resolución.
- Añadir estados vacíos didácticos con una acción primaria y una explicación corta de beneficio, no solo de ausencia de datos.
- Mejorar formularios largos con guardado explícito, cambios sin guardar, validación junto al campo y resumen de errores al enviar.
- Criterio de salida: un propietario puede configurar el camino mínimo hasta recibir una reserva sin asistencia.

### Fase 4 — Escala, densidad y administración (1–2 semanas)

- Añadir búsqueda, filtros explícitos, contador y paginación por cursor para equipo, facturas, fichajes, inventario y plataforma.
- Diseñar tablas responsivas: columnas prioritarias, detalle expandible y acciones agrupadas para pantallas pequeñas.
- Unificar cabecera, navegación, filtros, toolbar y estados de datos entre tenant y plataforma.
- Crear vistas de salud: suscripción, facturación, inventario, colas y notificaciones con severidad y siguientes pasos.
- Criterio de salida: listas de más de 100 registros mantienen rendimiento, URL compartible y acceso completo con teclado.

### Fase 5 — Reserva pública y confianza de marca (3–5 días)

- Conservar la identidad del restaurante, pero hacer persistente el resumen de selección (personas, día, hora y zona) en móvil.
- Visualizar la disponibilidad como estado progresivo: seleccionar servicio → día → comprobando → franjas → alternativa → confirmación.
- Añadir validación temprana y mensajes de recuperación junto al control afectado; no limpiar datos correctos ante un fallo recuperable.
- Mejorar confirmación con detalle escaneable, gestión/cancelación, expectativas de comunicación y calendarización si el producto lo prioriza.
- Criterio de salida: la tasa de éxito del formulario y el tiempo de reserva mejoran frente a la línea base de Fase 0.

## Backlog técnico y orden recomendado

1. Finalizar el patrón de feedback de mutaciones en Reservas, Servicio, TPV, Caja, Fichaje e Inventario.
2. Extraer primitivas visuales para cards accionables, alertas operativas, badges de estado y toolbars de listas.
3. Definir y aplicar el contrato de foco/motion/reduced-motion en el CSS compartido, evitando modificar código concurrente.
4. Mejorar la densidad y priorización del TPV y Servicio con pruebas de usabilidad de tareas concretas.
5. Implementar paginación/filtros desde servidor por módulo, conservando aislamiento por `tenant_id`.
6. Completar el checklist de onboarding y estados vacíos orientados a activación.
7. Instrumentar y revisar resultados quincenalmente; retirar cambios que no mejoren métricas o claridad.

## Validación continua

- **Automática:** `format:check`, lint, estructura, typecheck, unitarias y E2E no mutantes; ampliar Playwright para foco, estados pendientes y feedback de éxito/error.
- **Manual:** teclado completo, lector de pantalla en acciones críticas, ancho 320/390/768/1280 px, red lenta/offline y reduced motion.
- **Producto:** revisión semanal de acciones repetidas, errores recuperables y embudos de activación/reserva.
- **Guardarraíles:** no usar credenciales ni datos productivos en pruebas; ninguna prueba E2E debe mutar el único proyecto conectado.

## Entregas de este ciclo

- Se corrige el estado inicial de carga de la agenda para no comunicar una ausencia de reservas antes de recibir datos.
- Cancelar, marcar no-show y reprogramar pasan a estado pendiente, bloquean reenvíos y confirman el éxito en contexto.
- El control de actualización de agenda expresa visualmente el trabajo en curso y respeta reducción de movimiento.
