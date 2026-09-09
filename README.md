# SobreTaula

SaaS de suscripción para gestión integral de restaurantes independientes en
España. Reserva, servicio, cuenta y factura se operan desde el plano de la
sala. Diseño y decisiones en `docs/project-design.md` y `docs/adr/`.

## Puesta en marcha

1. Requisitos: Node 22+ y pnpm.
2. `pnpm install`.
3. Copia `.env.example` a `.env` y rellena las variables (contrato documentado
   en el propio fichero).
4. `pnpm dev` y abre la URL local.

## Calidad

`pnpm quality` ejecuta formato, lint, estructura, typecheck y tests. Es el
contrato de cualquier cierre de tarea y también corre en CI. El artefacto de
producción se verifica con `pnpm build` (typecheck + build del bundle cliente y
del servidor Node).

## Migraciones

SQL versionado en `supabase/migrations`, aplicadas en orden lexicográfico.
Nunca se edita una migración ya aplicada: se añade una nueva. Para aplicarlas:

- **Entorno de pruebas dedicado**: aplicación por MCP o `supabase db push`
  apuntando al proyecto de pruebas; nunca contra producción.
- **Producción**: aplicación autorizada de forma explícita, una persona
  ejecuta, otra revisa el diff antes.

## Variables de entorno

| Variable                                                                                           | Plano    | Uso                                                |
| -------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`                                               | Cliente  | Conexión pública protegida por RLS                 |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`                                  | Servidor | Cliente administrativo; nunca al bundle            |
| `SESSION_PASSWORD`                                                                                 | Servidor | Cifrado de la sesión del servidor (32+ caracteres) |
| `VERIFACTU_DEFAULT_ENV`                                                                            | Servidor | Entorno fiscal inicial de nuevos tenants (`test`)  |
| `TENANT_CERTIFICATE_MASTER_KEY`                                                                    | Servidor | Cifrado en reposo de certificados por tenant       |
| `REDSYS_*`, `APP_URL`, `PLATFORM_BILLING_CRON_SECRET`, `PLATFORM_PAYMENT_REFERENCE_ENCRYPTION_KEY` | Servidor | Cobros SaaS y callbacks firmados                   |
| `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY`                   | CI       | Smoke de RLS y concurrencia; nunca producción      |

## Smoke tests de integración

`src/features/*/infrastructure/server/*.smoke.test.ts` y `tenant-rls.test.ts`
corren contra un proyecto Supabase de pruebas dedicado y se saltan solos sin
credenciales (`describe.skip`). Cubren: aislamiento RLS, acceso anónimo
denegado, reserva concurrente de números de factura sin duplicados y storage
privado de PDFs con descarga cruzada denegada.

```sh
# .env.test (no versionado; ver .env.test.example)
pnpm exec vitest run src/features/tenancy src/features/invoices
```

Ningún smoke test emite facturas reales ni toca producción.

## Despliegue

Requisitos del runtime (ADR-0001): Node 22+, módulos nativos disponibles y
soporte del artefacto `dist/server/server.js`. No basta publicar assets
estáticos: el servidor Node es parte del producto (fiscalidad, PDF, webhooks).

1. Proyecto Supabase con las migraciones aplicadas y storage `invoice_documents`
   creado (migración `20260909000001`).
2. Secretos del servidor configurados en el gestor del entorno; nunca en el
   repositorio.
3. `pnpm quality` y `pnpm build` en verde.
4. Arrancar `node dist/server/server.js` detrás de proxy con TLS.
5. Post-despliegue: revisar advisors de Supabase y logs del servidor.

### VERI*FACTU

El MVP emite en `VERIFACTU_ENV=test` por tenant. Pasar un tenant a `prod`
exige: certificado `.pfx` cargado y cifrado, checklist de
`docs/implementation-status.md` completa y validación de un asesor fiscal.
