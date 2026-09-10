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

| Variable                                                                                           | Plano         | Uso                                                  |
| -------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`                                               | Cliente       | Conexión pública protegida por RLS                   |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`                                  | Servidor      | Cliente administrativo; nunca al bundle              |
| `SESSION_PASSWORD`                                                                                 | Servidor      | Cifrado de la sesión del servidor (32+ caracteres)   |
| `VERIFACTU_DEFAULT_ENV`                                                                            | Servidor      | Entorno fiscal inicial de nuevos tenants (`test`)    |
| `TENANT_CERTIFICATE_MASTER_KEY`                                                                    | Servidor      | Cifrado en reposo de certificados por tenant         |
| `REDSYS_ENVIRONMENT`, `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL=999`, `REDSYS_CURRENCY=978`, `REDSYS_SECRET_KEY`, `APP_URL`, `PLATFORM_BILLING_CRON_SECRET`, `PLATFORM_PAYMENT_REFERENCE_ENCRYPTION_KEY` | Servidor | Cobros SaaS, tokenización, invitaciones y callbacks firmados |
| `NOTIFICATION_CRON_SECRET`, `NOTIFICATION_WORKER_TOKEN`                                            | Servidor      | Worker autenticado de notificaciones                 |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                                              | Edge Function | Confirmaciones por correo con remitente verificado   |
| `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY`                   | CI            | Solo con proyecto de pruebas dedicado; hoy no aplica |

## Pruebas de integración

`tenant-rls.test.ts` cubre aislamiento RLS entre tenants y requiere un proyecto
Supabase de pruebas dedicado; se salta solo sin credenciales (`describe.skip`).
Hoy solo existe el proyecto de producción, así que la suite no llega a ejecutar
sus escrituras de fixture: **nunca se apunta a producción**. Cuando exista un
proyecto de pruebas, rellena `.env.test` (contrato en `.env.test.example`) y
ejecuta:

```sh
pnpm exec vitest run src/features/tenancy
```

## Despliegue

Requisitos del runtime (ADR-0001): Node 22+, módulos nativos disponibles y
soporte del artefacto `dist/server/server.js`. No basta publicar assets
estáticos: el servidor Node es parte del producto (fiscalidad, PDF, webhooks).

1. Proyecto Supabase con las migraciones aplicadas y storage `invoice_documents`
   creado (migraciones `20260909000001` a `20260909000003`).
2. Secretos del servidor configurados en el gestor del entorno; nunca en el
   repositorio.
3. En Supabase Auth, añadir `${APP_URL}/activar-cuenta` y
   `${APP_URL}/restablecer-contrasena` a las Redirect URLs autorizadas para los
   enlaces de invitación y recuperación de contraseña.
4. En Vercel, importar el repositorio con `internal/projects/sobretaula` como
   **Root Directory**, Node 22+ y `pnpm build` como Build Command. Nitro usa
   el preset de Vercel y genera el artefacto serverless automáticamente.
5. Configurar `APP_URL` con el dominio de producción y los demás secretos sólo
   en las variables de entorno de Vercel; nunca en el repositorio.
   Configurar también los secretos `APP_URL` y `NOTIFICATION_CRON_SECRET` en
   GitHub Actions: el workflow `process-notifications.yml` activa el worker de
   notificaciones cada cinco minutos.
   En la Edge Function `process-notification-jobs`, configurar los secretos
   `RESEND_API_KEY` y `RESEND_FROM_EMAIL` (un buzón de un dominio verificado en
   Resend). El nombre visible, logo, color y correo de respuesta se gestionan
   por restaurante desde Comunicaciones.
6. `pnpm quality` y `pnpm build` en verde.
7. Post-despliegue: revisar advisors de Supabase y logs del servidor.

### VERI*FACTU

El MVP emite en `VERIFACTU_ENV=test` por tenant. Pasar un tenant a `prod`
exige: certificado `.pfx` cargado y cifrado, checklist de
`docs/implementation-status.md` completa y validación de un asesor fiscal.
