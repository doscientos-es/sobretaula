# ADR-0001 · TanStack Start sobre runtime Node

- Estado: aceptado (2026-09-08), pendiente de superar la puerta de adopción.
- Decide: stack de aplicación de SobreTaula.

## Contexto

SobreTaula necesita operaciones que no pueden vivir en el navegador:

- Emisión VERI\*FACTU: `@doscientos/verifactu` usa PFX/mTLS y `libxmljs2`
  (dependencia nativa). No es compatible con Edge/Workers.
- Generación y descarga privada de PDF de facturas.
- Webhooks de canales de reserva y confirmaciones/recordatorios programados.
- Worker de outbox fiscal con reintentos y bloqueo por emisor.
- Resolución y autorización de tenant antes de servir datos privados.

La tabla de decisión de `operational-react-supabase` marca este caso como
«app nueva con servidor integrado necesario para facturación, PDF o
integraciones privadas → TanStack Start + React + Query + Supabase sobre Node,
aprobando y validando piloto antes de estandarizar».

## Decisión

TanStack Start (React 19, TanStack Router, TanStack Query, Tailwind v4,
`@doscientos/ui`, `@doscientos/configs`) desplegado en un runtime Node.
Supabase aporta Postgres, Auth, Storage y RLS.

SobreTaula es el **piloto** de Start en Doscientos y asume su puerta de
adopción. El generador `@doscientos/create-operational-app` produce únicamente
Vite/Router, así que el esqueleto se construye a mano respetando los mismos
contratos y scripts de calidad.

## Alternativas descartadas

| Alternativa                            | Motivo del descarte                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Vite SPA + servicio Node fiscal aparte | Dos despliegues, dos autenticaciones, tenant resuelto en cliente; más superficie por el mismo problema             |
| Next.js                                | El backoffice lo usa, pero el protocolo no lo asume por defecto en apps operativas nuevas y no aporta ventaja aquí |
| Astro                                  | Producto de aplicación autenticada, no de contenido                                                                |

## Consecuencias

- Hosting obligado a runtime Node con soporte de módulos nativos y del artefacto
  servidor. No basta publicar los assets estáticos.
- Hay que confirmar en el runtime real: versión de Node, arquitectura, acceso al
  certificado y límites de duración del request. Nunca con emisión real.
- Convención de sufijos `.server.ts` / `.functions.ts`. `doscientos-structure`
  todavía no los reconoce: se documentará la excepción concreta en lugar de
  renombrar archivos para ocultar el fallo.
- Se debe verificar el comportamiento CSRF/origen de la versión instalada de
  Start si se personaliza `src/start.ts`.

## Evidencias pendientes de la puerta de adopción

1. Instalación limpia, tipos, lint, tests y build del artefacto Node.
2. Login/logout/expiración y refresh, sin caché compartida entre usuarios.
3. Autorización directa de endpoints: tenant ajeno → 403, anónimo → 401.
4. Listado con URL, loader, pending/error, reintento y mutación con
   invalidación correcta.
5. Emisión con dos intentos concurrentes, idempotente y sin números duplicados.
6. PDF privado reutilizable; descarga cruzada denegada; fiscalidad fuera del
   bundle cliente.
7. Integración fiscal en `mock` y `test` con compatibilidad del runtime.

Cada punto se cierra con evidencia reproducible en
`docs/implementation-status.md`. Un punto sin ejecutar es pendiente, no aprobado.
