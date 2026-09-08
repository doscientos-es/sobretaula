# ADR-0006 · Arquitectura modular, SOLID y adaptadores

- Estado: aceptado (2026-09-08).
- Decide: cómo se organiza el código para que añadir módulos no rompa nada.

## Contexto

SobreTaula empieza con reservas y termina siendo una suite. El riesgo no es
escribir el primer módulo, es que el quinto obligue a reescribir los cuatro
anteriores. El requisito explícito es SOLID, un componente por archivo, feature
based y con adaptadores.

## Decisión

**Un vertical por módulo**, con cuatro capas y una única puerta de entrada:

```
features/reservations/
  domain/        reglas puras: disponibilidad, pacing, best-fit. Sin React, sin IO
  application/   schemas zod, queryOptions, casos de uso, *.functions.ts (RPC)
  infrastructure/ *.server.ts: adaptadores Supabase, correo, canales externos
  ui/            un componente por archivo
  index.ts       API pública client-safe, pequeña
```

Reglas de dependencia, comprobables:

1. `domain` no importa nada del proyecto salvo `shared/lib` puro. No importa
   React, ni Supabase, ni otro módulo.
2. `application` importa `domain` e `infrastructure`; nunca al revés.
3. `ui` no importa `infrastructure`. Recibe datos por props o por hooks de
   `application`.
4. **Un módulo no importa el interior de otro.** Solo su `index.ts`. Si dos
   módulos necesitan compartir una regla, sube a `shared/` con un contrato
   propio y su prueba, no por copia.
5. `routes/` compone; no contiene lógica de negocio ni conoce Supabase.

**SOLID aplicado sin ceremonia:** un archivo, una responsabilidad; funciones
puras para las reglas; extensión por composición. No se introducen clases,
contenedor DI ni repositorio genérico para un CRUD. Se extrae un **puerto**
cuando existe una frontera real —persistencia, PDF, AEAT, correo, reloj— y no
por cada función. Los puertos son tipos de función o interfaces pequeñas; los
adaptadores viven en `infrastructure` y se inyectan desde el caso de uso.

**Un componente por archivo.** El nombre del archivo es el nombre del
componente en kebab-case. Sin componentes anónimos exportados por defecto ni
subcomponentes definidos dentro de otro archivo.

**Módulos y suscripción:** cada módulo declara su clave de entitlement. Un
módulo desactivado por plan se bloquea en el caso de uso del servidor y además
se oculta en navegación. Ocultar el enlace no es autorizar.

## Consecuencias

- El coste inicial es mayor que un `src/pages` plano; el objetivo es el módulo
  número cinco, no el primero.
- `doscientos-structure` valida estructura y nombres. La convención de sufijos
  `.server.ts` / `.functions.ts` que Start necesita todavía no está soportada:
  se documenta la excepción concreta en `implementation-status.md` y, si
  procede, se propone la regresión en `@doscientos/configs`. No se desactiva el
  check ni se renombran archivos para esconder el fallo.
- Reglas de negocio específicas de SobreTaula no suben a `@doscientos/billing`
  ni a `@doscientos/ui` sin un contrato reutilizable justificado.
