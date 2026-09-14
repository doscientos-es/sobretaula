# SobreTaula

SaaS de suscripción para gestión integral de restaurantes independientes en
España. El MVP ampliado cubre reservas, sala, TPV, comandas, cocina/barra,
cuenta, cobros, caja, facturación, control horario e inventario/producto.
Diseño y decisiones en `docs/project-design.md` y `docs/adr/`; el contraste
contra la petición del cliente está en `docs/client-mvp-gap-analysis.md`.

## Puesta en marcha

1. Requisitos: Node 22+ y pnpm.
2. `pnpm install`.
3. Configura `.env.local` con los valores comunes y de producción local, y
   `.env.test` con las sustituciones del proyecto Supabase de pruebas (el
   contrato está en [Variables de entorno](#variables-de-entorno)). Ambos
   ficheros están ignorados por Git.
4. `pnpm dev` y abre la URL local. Arranca en modo `test` y usa Supabase de
   pruebas por defecto.

Para abrir explícitamente la aplicación contra datos reales existe
`pnpm dev:production`; no es un flujo de pruebas y solo debe usarse para
diagnóstico excepcional, con especial cuidado de no ejecutar operaciones que
escriban datos.

## Calidad

`pnpm quality` ejecuta formato, lint, estructura, typecheck y tests. Es el
contrato de cualquier cierre de tarea y también corre en CI. El artefacto de
producción se verifica con `pnpm build` (typecheck + build del bundle cliente y
del servidor Node).

Tras clonar el repositorio, ejecuta `pnpm hooks:install` una vez. El hook
`pre-commit` verifica formato y lint con `pnpm quality:quick`, sin modificar
archivos ni el índice.

## Migraciones

SQL versionado en `supabase/migrations`, aplicadas en orden lexicográfico.
Nunca se edita una migración ya aplicada: se añade una nueva. El esquema, las
políticas RLS, funciones y definición de buckets se sincronizan desde estas
migraciones; los datos, usuarios y objetos de Storage no se copian de
producción. Las migraciones se ensayan primero en pruebas y solo se aplican a
producción de forma individual, tras confirmar expresamente el destino y
verificar el esquema. Nunca se usan fixtures, humo, carga ni pruebas de
concurrencia sobre producción.

## Cuentas demo

La lista de cuentas de presentación ya existentes, sus roles y los tenants de
escenario está en [`docs/demo-users.md`](docs/demo-users.md). Las contraseñas no
se versionan; usa recuperación de contraseña o invitación si necesitas
restablecer el acceso.

## Variables de entorno

| Variable                                                                                                                                                                                                | Plano         | Uso                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------ |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`                                                                                                                                                    | Cliente       | Conexión pública protegida por RLS                           |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`                                                                                                                                       | Servidor      | Cliente administrativo; nunca al bundle                      |
| `SESSION_PASSWORD`                                                                                                                                                                                      | Servidor      | Cifrado de la sesión del servidor (32+ caracteres)           |
| `TENANT_CERTIFICATE_MASTER_KEY`                                                                                                                                                                         | Servidor      | Cifrado en reposo de certificados por tenant                 |
| `REDSYS_ENVIRONMENT`, `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL=999`, `REDSYS_CURRENCY=978`, `REDSYS_SECRET_KEY`, `APP_URL`, `PLATFORM_BILLING_CRON_SECRET`, `PLATFORM_PAYMENT_REFERENCE_ENCRYPTION_KEY` | Servidor      | Cobros SaaS, tokenización, invitaciones y callbacks firmados |
| `NOTIFICATION_CRON_SECRET`, `NOTIFICATION_WORKER_TOKEN`                                                                                                                                                 | Servidor      | Worker autenticado de notificaciones                         |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                                                                                                                                                   | Edge Function | Confirmaciones por correo con remitente verificado           |

### Perfiles locales y pruebas

Vite carga `.env.local` como base y, con `--mode test`, aplica después
`.env.test`. Por ello `.env.test` puede contener solo las variables que cambian
respecto a `.env.local`, pero debe sustituir el conjunto completo de Supabase
usado por la aplicación para evitar mezclar los dos proyectos:

| Variable en `.env.test`                                                          | Motivo                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`                             | Cliente web contra el proyecto de pruebas.                                                   |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`                | Clientes de servidor y operaciones administrativas contra ese mismo proyecto.                |
| `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY` | Prueba RLS mutante, con prefijo que impide que se ejecute accidentalmente contra producción. |

`DB_PASSWORD` no lo consume la aplicación web y no sustituye
`SUPABASE_SECRET_KEY`. Las tres variables `SUPABASE_TEST_*` pueden referenciar
las credenciales de pruebas, pero nunca las de producción. Mientras falte alguna
de ellas, la prueba RLS queda omitida por seguridad.

- `pnpm dev` o `pnpm dev:test`: desarrollo contra Supabase de pruebas.
- `pnpm build:test`: compila el artefacto con las variables públicas de pruebas.
- `pnpm dev:production`: acceso local explícito a producción; no usar para
  pruebas, fixtures ni E2E.

## Pruebas de integración

`tenant-rls.test.ts` cubre aislamiento RLS entre tenants y crea datos efímeros
solo si están configuradas las tres variables `SUPABASE_TEST_*` del proyecto de
pruebas. Se limpia al finalizar. La revisión de migraciones comprueba sus
políticas y grants; las pruebas unitarias y de interfaz no se conectan a
producción.

Para E2E, deja `pnpm dev` activo en un terminal y ejecuta `pnpm test:e2e` en
otro. La sesión `E2E_STORAGE_STATE` debe pertenecer exclusivamente a un usuario
y tenant de pruebas; sin ella se ejecutan únicamente los escenarios públicos.

Las tarjetas sandbox y las condiciones necesarias para probar Redsys están en
[`docs/redsys-testing.md`](docs/redsys-testing.md).

## Despliegue

Requisitos del runtime (ADR-0001): Node 22+, módulos nativos disponibles y
soporte del artefacto `dist/server/server.js`. No basta publicar assets
estáticos: el servidor Node es parte del producto (fiscalidad, PDF, webhooks).

1. Antes del despliegue, los proyectos Supabase de pruebas y producción deben
   tener aplicadas las migraciones del release y el bucket `invoice_documents`
   creado por dichas migraciones. Los datos de prueba se crean únicamente en el
   proyecto de pruebas.
2. Secretos del servidor configurados en el gestor del entorno; nunca en el
   repositorio.
3. En Supabase Auth, añadir `${APP_URL}/activar-cuenta` y
   `${APP_URL}/restablecer-contrasena` a las Redirect URLs autorizadas para los
   enlaces de invitación y recuperación de contraseña.
4. En Vercel, importar el repositorio con `internal/projects/sobretaula` como
   **Root Directory**, Node 22+ y `pnpm build` como Build Command. Nitro usa
   el preset de Vercel y genera el artefacto serverless automáticamente.
5. Vercel no lee `.env.local` ni `.env.test` del repositorio. En **Settings →
   Environment Variables**, configura los valores del proyecto de pruebas en el
   alcance **Preview** y los de producción en **Production**. Para ambos
   alcances, `VITE_SUPABASE_*` y `SUPABASE_*` deben pertenecer al mismo proyecto;
   nunca selecciones una variable para todos los entornos si contiene una clave
   administrativa. Configura además `APP_URL` con el dominio correspondiente y
   sustituye por valores de prueba/sandbox cualquier integración externa que
   pueda escribir o enviar datos (pagos, correo y webhooks). Nunca subas esos
   secretos al repositorio.
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
