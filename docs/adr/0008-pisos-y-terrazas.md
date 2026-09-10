# ADR-0008 · Pisos, zonas y terrazas en el plano

Estado: propuesta preparada para aplicar

## Decisión

Las áreas existentes seguirán siendo la unidad operativa de reservas y mesas.
Se añadirán metadatos compatibles (`floor_number`, `space_type` y configuración
de apertura exterior) en `areas`, sin duplicar mesas ni crear un segundo plano
por planta. Las versiones de `floor_plan_versions` conservarán sus intervalos
`active_from`/`active_to` y se resolverán por área y fecha.

## Compatibilidad

`floor_number` será nullable para no romper locales ya creados. Un área antigua
se mostrará como “Sin planta asignada” y “Zona”. Los loaders aceptarán ambos
formatos durante el despliegue gradual.

## Seguridad

La migración debe mantener RLS de tenant y permisos de owner/manager. No se
expondrán configuraciones de terraza a usuarios de otro tenant. Cualquier
función de activación debe ser idempotente y auditable.

## Reglas de publicación

- No se permiten intervalos temporales solapados dentro de la misma área.
- Un layout futuro no sustituye al activo hasta su instante de activación.
- Cerrar una terraza no elimina mesas ni reservas; cambia su disponibilidad y
  requiere una acción explícita de traslado.

## Verificación requerida

Aplicar la migración en Supabase de pruebas, ejecutar advisors, comprobar RLS
entre tenants y probar un cambio de layout que cruce medianoche y zona horaria.
