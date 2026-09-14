# Suite E2E operativa

Esta suite contiene exactamente diez escenarios etiquetados por rol, módulo y prioridad en `e2e/operational-flows.spec.ts`. Comprueba que las pantallas críticas cargan con una sesión del rol correcto, que la navegación llega al módulo esperado y que los límites anónimos se aplican.

## Entorno seguro

Los tests autenticados solo se ejecutan contra Supabase de pruebas. Hay que configurar `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY` y `E2E_BASE_URL`. El seed crea o renueva cinco usuarios (`owner`, `manager`, `host`, `waiter`, `accountant`) con memberships del tenant indicado por `E2E_TENANT_SLUG`.

Nunca se deben ejecutar `e2e-seed`, humo o esta suite contra producción. Las credenciales permanecen en `.env.test` o en el gestor de secretos del CI.

## Ejecución

```powershell
pnpm e2e:seed
$env:E2E_BASE_URL = 'http://localhost:3001'
pnpm test:e2e -- e2e/operational-flows.spec.ts
pnpm test:e2e -- --grep '@P0'
pnpm test:e2e -- --project=waiter
```

Playwright guarda un estado independiente en `e2e/.auth/<rol>.json`. En caso de fallo conserva trace, screenshot, vídeo y el reporte HTML. Los helpers fallan indicando el escenario y verifican que no aparece el error boundary ni una pantalla vacía.

## Matriz de cobertura

|   # | Rol           | Módulo                  | Prioridad | Riesgo principal                        |
| --: | ------------- | ----------------------- | --------- | --------------------------------------- |
|   1 | owner         | activación/operaciones  | P0        | tenant o local no resoluble             |
|   2 | owner         | caja                    | P0        | permisos o estado de apertura           |
|   3 | manager       | TPV/cuenta              | P0        | operación diaria incompleta             |
|   4 | manager       | autorización financiera | P0        | mutación fuera de rol                   |
|   5 | host          | reserva pública/agenda  | P0        | reserva no visible o PII expuesta       |
|   6 | host          | servicio/sala           | P0        | estado de mesa no operativo             |
|   7 | waiter        | TPV móvil/comanda       | P0        | UX móvil o duplicación                  |
|   8 | waiter        | fichaje                 | P1        | terminal inaccesible o feedback ausente |
|   9 | accountant    | facturación/informes    | P1        | exportación o datos sensibles           |
|  10 | owner/anónimo | seguridad               | P0        | ruta privada accesible sin sesión       |

Esta primera capa no certifica fiscalidad, RLS entre tenants, concurrencia ni proveedor de correo. Esos gates requieren un entorno autorizado y pruebas específicas; un build verde no los sustituye.
