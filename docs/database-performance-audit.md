# Auditoría de base de datos y escalabilidad

Fecha: 2026-09-17

## Alcance y evidencia

Esta revisión cubre los 177 ficheros de migración del repositorio, las tablas de negocio,
las restricciones, los índices declarados, las políticas RLS y los patrones de
acceso visibles en el código. No sustituye una auditoría de rendimiento en
producción. Los proyectos Supabase autorizados fueron identificados y sus
historiales y advisors se consultaron sin leer datos operativos; no se han
ejecutado `EXPLAIN ANALYZE` ni consultas sobre datos reales.

El árbol local contiene migraciones posteriores al último nombre reconocido en
el historial remoto. En particular, `20260913000047_payment_line_allocations.sql`
queda fuera de esta auditoría remota hasta que se revise y aplique explícitamente.

## Estado actual

La base parte de una arquitectura adecuada para un SaaS multi-restaurante:

- Las tablas de negocio están aisladas por `tenant_id` y, cuando corresponde,
  `venue_id`.
- `memberships` separa identidad global de rol dentro de cada restaurante.
- Hay índices explícitos para la mayoría de claves foráneas y para colas,
  reservas, sesiones abiertas, auditoría, inventario, compras y fichajes.
- RLS está forzada en el esquema público según la auditoría de cierre del
  proyecto.
- Las mutaciones sensibles tienen idempotencia y varias auditorías append-only.
- El catálogo comercial y los módulos ampliados ya tienen tablas y rutas propias;
  todavía no hay métricas de producción suficientes para evaluar su coste.

No recomiendo rediseñar las tablas ni particionar todavía. Con un MVP, añadir
índices sin medir puede empeorar el TPV y las escrituras de reservas.

## Mejoras priorizadas

### P0: medir antes de tocar producción

1. Ejecutar Supabase Database Advisors de seguridad y rendimiento.
2. Revisar `pg_stat_statements` durante un servicio real.
3. Capturar `EXPLAIN (ANALYZE, BUFFERS)` para plano, reservas, TPV/cuentas,
   comandas, fichajes, inventario y dashboard.
4. Comparar latencia p50/p95 y lecturas por tenant y local.

### P1: índices compuestos guiados por planes

Validar si las consultas reales necesitan índices compuestos con este patrón:

```sql
(tenant_id, venue_id, created_at desc)
(tenant_id, venue_id, starts_at)
(tenant_id, status, created_at desc)
```

Solo deben crearse cuando `EXPLAIN` demuestre un beneficio. Las tablas con más
probabilidad de necesitarlos son `reservations`, `table_sessions`, `orders`,
`inventory_movements` y `timekeeping_events`.

### P1: reducir coste de dashboards

Evitar recalcular históricos completos en cada carga. Si las métricas crecen,
crear agregados diarios/semanales por tenant y local, conservando las tablas
transaccionales como fuente de verdad.

### P1: retención y particionado diferido

Definir retención para notificaciones, eventos operativos y logs. Particionar
solo cuando una tabla temporal supere un volumen que lo justifique, empezando
por auditoría/eventos y no por las tablas transaccionales del TPV.

### P2: RLS y funciones

Mantener las políticas tenant-scoped, pero verificar que las funciones usadas
por RLS sean pequeñas, tengan índices de soporte y no hagan consultas repetidas
por fila. No mover roles de negocio a JWT: pueden cambiar por restaurante y los
claims pueden quedar obsoletos.

## Próxima ejecución con acceso al proyecto

```sql
select query, calls, total_exec_time, mean_exec_time, rows
from pg_stat_statements
order by total_exec_time desc
limit 30;
```

Después se deben guardar en esta auditoría los planes de las cinco consultas
más caras y convertir solo las mejoras confirmadas en migraciones pequeñas,
con `create index concurrently` cuando el entorno y la ventana de despliegue
lo permitan.

## Revisión remota de proyectos y advisors — 2026-09-17

Se consultaron en modo lectura los proyectos `sobretaula-dev` y `sobretaula`.
Ambos aparecen `ACTIVE_HEALTHY` y sus historiales llegan a
`integrate_floor_maps`. No se aplicaron migraciones, cambios de configuración ni
escrituras de datos durante esta revisión.

El proyecto de pruebas devuelve estos avisos que requieren una decisión
explícita, no un `db push` automático:

- **Seguridad:** 4 tablas internas tienen RLS sin políticas
  (`public_reservation_rate_limits`, `timekeeping_pin_attempts`,
  `timekeeping_pins` y `timekeeping_terminal_attempts`). El comportamiento
  actual es denegación por defecto y parece intencionado porque se accede a
  ellas desde funciones protegidas; debe conservarse así o documentarse con
  una prueba de contrato.
- **Seguridad:** 19 funciones `SECURITY DEFINER` son invocables por `anon`,
  incluidas las RPC públicas de reservas, disponibilidad y carta. La exposición
  parece parte del producto, pero cada función debe tener límites por
  slug/token y `search_path` fijo.
- **Auth:** la protección contra contraseñas filtradas está desactivada en
  Supabase; es un cambio de configuración por entorno pendiente de confirmación,
  no una migración SQL.
- **Rendimiento:** el advisor informa de 102 claves foráneas sin índice de
  cobertura, 12 políticas con reevaluación por fila y múltiples políticas
  permisivas. No se añadieron índices especulativos: primero hay que medir
  p50/p95 y confirmar los paths operativos.

El árbol local contiene 177 migraciones y dos comparten el prefijo
`20260915000004` (`operational_read_indexes` y
`platform_fiscal_invoice_documents`). Los historiales remotos contienen ambas
operaciones bajo versiones distintas, por lo que no se deben renombrar ni
reaplicar esos ficheros sin reconciliar antes la cadena de migraciones.

## Resultado

La mejora de mayor valor inmediata no es añadir DDL especulativo: es cerrar la
brecha de observabilidad de consultas. La estructura actual está preparada para
crecer, pero todavía no hay evidencia de carga/concurrencia suficiente para
afirmar qué índice o partición aportaría rendimiento real.
