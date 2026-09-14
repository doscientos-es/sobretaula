# Instrucciones de Sobretaula

La producción usa Supabase gestionado con datos reales. Nunca incluir ni reutilizar credenciales,
URLs o datos de producción en entornos de prueba.

En augment: El proyecto usa el mcp de polbackup05 para conectarse a supabase

## Migraciones de Supabase

Cuando el agente cree o modifique una migración en `supabase/migrations`, debe
revisarla y verificar primero el proyecto Supabase y el estado de la BBDD destino.
No se aplican migraciones remotas si el proyecto destino es ambiguo, si no se
puede inspeccionar el estado actual o si la operación podría afectar producción
sin confirmación explícita para ese cambio concreto.

### Entornos y fuente de verdad

- `sobretaula-dev` es el único proyecto de **pruebas**. `sobretaula` es el
  proyecto de **producción**. Antes de cualquier operación remota, el agente
  debe listar los proyectos disponibles por MCP y comprobar su nombre, estado e
  historial de migraciones; no debe fiarse de una URL, una credencial o un ref
  aportados de forma aislada.
- `supabase/migrations` es la única fuente de verdad para esquema, extensiones,
  funciones SQL, políticas RLS, grants y definición de buckets. Nunca se edita
  una migración aplicada: se crea una nueva en orden lexicográfico.
- Producción y pruebas comparten el esquema de cada release, no los datos. Los
  tenants, usuarios Auth, sesiones, seeds, fixtures, documentos de Storage y
  cuentas E2E se crean y eliminan exclusivamente en `sobretaula-dev`.
- Nunca se copia, restaura, exporta ni usa información de producción para
  poblar pruebas, ni siquiera para datos de demo. No se reutilizan secretos,
  URLs, cookies, tokens ni claves de servicios externos de producción.

### Protocolo obligatorio de una migración

1. Revisar el SQL local y sus dependencias; comprobar la lista de migraciones
   locales y el historial de los dos proyectos por MCP, solo en modo lectura.
2. Confirmar que el primer destino es inequívocamente `sobretaula-dev`. Si el
   proyecto de pruebas está vacío, solo se inicializa con las migraciones
   versionadas del repositorio tras una petición del usuario que lo autorice.
3. Aplicar la migración o inicialización **solo** en pruebas. Verificar después
   el historial, el esquema afectado y las políticas/grants relevantes.
4. Ejecutar las pruebas unitarias y las integraciones/E2E contra el proyecto de
   pruebas. Las pruebas que escriben datos deben tener cleanup y usar solamente
   credenciales de prueba.
5. Informar al usuario de las migraciones exactas, de la validación realizada y
   de cualquier diferencia pendiente. No aplicar nada a producción todavía.
6. Aplicar en `sobretaula` únicamente cuando el usuario confirme de forma
   explícita esas migraciones concretas y ese destino. Antes de aplicar,
   reconsultar el historial de producción; después, verificar historial,
   esquema, RLS y logs. No se afirma sincronización hasta completar este paso.

Durante el desarrollo puede haber migraciones validadas en pruebas que aún no
están en producción. Tras publicar un release, los dos proyectos deben tener
el mismo conjunto de cambios de esquema; que sus datos sean distintos es
intencional.

### Recursos y configuración fuera de las migraciones

- Los cambios de `supabase/functions` se despliegan primero al proyecto de
  pruebas y se comprueban allí. El despliegue de la misma función a producción
  exige confirmación explícita independiente.
- Auth Redirect URLs, secretos de Edge Functions, cron jobs, dominios, correo,
  pagos y webhooks se configuran por entorno. Preview usa valores de prueba o
  sandbox; Production usa solo sus valores de producción.
- Vercel no lee `.env.local` ni `.env.test`. En Vercel, las variables de
  Supabase de `Preview` apuntan íntegramente a `sobretaula-dev` y las de
  `Production` íntegramente a `sobretaula`. Nunca se comparte una clave
  administrativa entre ambos alcances.
- En local, `pnpm dev` usa el modo `test`; `.env.test` debe sobrescribir todas
  las variables de Supabase usadas por cliente y servidor. Para RLS se exigen
  `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY` y
  `SUPABASE_TEST_SECRET_KEY`, siempre del proyecto de pruebas.

## Demo y E2E

La suite E2E se ejecuta con `pnpm test:e2e`. La prueba pública es no mutante y
siempre debe pasar sin credenciales. Los escenarios autenticados solo se activan
con `E2E_STORAGE_STATE`, generado para un usuario y tenant de pruebas; nunca se
debe reutilizar `.env.local`, cookies ni snapshots de producción. Ejemplo:

```powershell
$env:E2E_STORAGE_STATE = 'e2e/.auth/test-tenant.json'
pnpm test:e2e
```

Si no existe ese estado autenticado, la suite lo indica y omite únicamente los
escenarios que lo requieren. Antes de afirmar que el MVP está validado de extremo
a extremo hay que ejecutar la suite con ese estado y verificar también la BBDD de
pruebas.
