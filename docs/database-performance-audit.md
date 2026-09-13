# Auditoría de base de datos y escalabilidad

Fecha: 2026-09-13

## Alcance y evidencia

Esta revisión cubre los 151 ficheros de migración del repositorio, las tablas de negocio,
las restricciones, los índices declarados, las políticas RLS y los patrones de
acceso visibles en el código. No sustituye una auditoría de rendimiento en
producción. El proyecto Supabase autorizado fue identificado y su historial de
migraciones se consultó sin leer datos operativos; no se han ejecutado
`EXPLAIN ANALYZE`, advisors ni consultas sobre datos reales.

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

## Resultado

La mejora de mayor valor inmediata no es añadir DDL especulativo: es cerrar la
brecha de observabilidad de consultas. La estructura actual está preparada para
crecer, pero todavía no hay evidencia de carga/concurrencia suficiente para
afirmar qué índice o partición aportaría rendimiento real.
