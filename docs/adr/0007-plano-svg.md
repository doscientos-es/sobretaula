# ADR-0007 · Plano de sala en SVG, 2D cenital, dos modos

- Estado: aceptado (2026-09-08).
- Decide: tecnología de render y modelo de interacción del diseñador de sala.

## Contexto

El plano es el diferencial del producto y el punto flojo de la competencia. Se
evaluaron Canvas 2D, WebGL/3D y SVG. La aplicación debe cumplir WCAG 2.2 AA y
funcionar con el dedo en una tablet, de pie, con prisa.

## Decisión

**SVG con React**, vista cenital 2D. No Canvas, no 3D.

| Criterio                        | SVG            | Canvas      | WebGL/3D    |
| ------------------------------- | -------------- | ----------- | ----------- |
| Hit-testing por elemento        | Nativo         | Manual      | Manual      |
| Foco de teclado y accesibilidad | Real, por nodo | Inexistente | Inexistente |
| Texto nítido a cualquier zoom   | Sí             | Reescalado  | Complejo    |
| Exportar plano a PDF/impresión  | Directo        | Rasterizado | No          |
| Escenas de 20–150 mesas         | Suficiente     | Suficiente  | Excesivo    |

El 3D es una demo bonita y una operación peor: oclusión, cámara, y un jefe de
sala que solo quiere tocar la mesa 12. Una cenital 2D cuidada con sombras y
materiales se ve igual de bien. Si se quiere el efecto, una isométrica opcional
en fase posterior sobre el **mismo** modelo de datos.

Si una escena grande degradase el rendimiento, la respuesta es virtualizar y
memoizar por elemento, no cambiar de tecnología.

## Modelo de interacción

**Dos modos, misma escena, distinto contrato:**

- _Diseño_: rejilla, snap, medidas en metros, paredes y aperturas, capas por
  área, alinear y distribuir, deshacer/rehacer, guardar como versión.
- _Servicio_: sin arrastre accidental. Tap para sentar, estados por color +
  icono + texto, temporizador por mesa, arrastrar una mesa sobre otra propone
  unir.

**Unir y separar mesas con un gesto**, durante el servicio, sin pasar por
ajustes. Es exactamente lo que la competencia resuelve mal con «table chains»
preconfiguradas. Las combinaciones frecuentes se pueden guardar, pero guardarlas
no es requisito para usarlas.

**Layouts versionados** («Verano terraza», «Invierno», «Nochevieja») con
activación por rango de fechas. Editar el layout activo no debe alterar
retroactivamente reservas ya asignadas: las sesiones referencian la versión.

**Coordenadas** en centímetros enteros sobre un plano por área, origen arriba a
la izquierda, rotación en grados enteros. Enteros, no flotantes: el snap y la
igualdad son exactos y el diff entre versiones es legible.

## Accesibilidad

- Vista de lista sincronizada como **alternativa completa** al plano, no como
  degradado. Cualquier acción del plano existe en la lista.
- Navegación por teclado entre mesas con orden espacial estable; mover con
  flechas en modo diseño, con paso de rejilla y paso fino.
- El estado nunca se comunica solo por color: color + icono + etiqueta textual.
- Objetivos táctiles mínimos y zoom sin pérdida de funcionalidad.
- El SVG interactivo expone roles y nombres accesibles por elemento; el plano
  decorativo (paredes, suelo) queda oculto al lector de pantalla.

## Consecuencias

- El estado del editor es un módulo puro y testeable (`domain/`), independiente
  de React: snap, colisiones, agrupación y deshacer se prueban sin renderizar.
- El guardado es por versión completa e inmutable, no por parche incremental;
  simplifica el conflicto entre dos dispositivos editando a la vez.
- La sincronía en vivo del modo servicio usa Supabase Realtime sobre estado de
  sesión, no sobre geometría.
