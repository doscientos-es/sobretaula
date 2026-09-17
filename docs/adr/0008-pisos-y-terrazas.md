# ADR-0008 · Pisos, zonas y terrazas en el plano

Estado: aceptado y aplicado en el proyecto autorizado (2026-09-13)

## Decisión

Las áreas existentes seguirán siendo la unidad operativa de reservas y mesas.
Se añadirán metadatos compatibles (`floor_number`, `space_type` y configuración
de apertura exterior) en `areas`, sin duplicar mesas ni crear un segundo plano
por planta. Cada área tendrá un único `floor_plans` operativo; los cambios de
dimensiones o geometría se guardan como una nueva configuración completa.

## Compatibilidad

`floor_number` será nullable para no romper locales ya creados. Un área antigua
se mostrará como “Sin planta asignada” y “Zona”. Los loaders aceptarán ambos
formatos durante el despliegue gradual.

## Seguridad

La migración mantiene RLS de tenant y permisos de owner/manager. No se
exponen configuraciones de terraza a usuarios de otro tenant. Cualquier
función de activación debe ser idempotente y auditable.

## Reglas operativas

- Solo existe un plano operativo por área.
- Cerrar una terraza no elimina mesas ni reservas; cambia su disponibilidad y
  requiere una acción explícita de traslado.

## Verificación requerida

La migración `20260916140000_single_floor_plan_per_area.sql` consolida el modelo
anterior en `floor_plans` y garantiza unicidad por área. La verificación remota
de RLS y del despliegue sigue requiriendo acceso autenticado al proyecto.
