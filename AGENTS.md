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
