# Modelo de datos

Diseño de F0 materializado incrementalmente en `supabase/migrations/`: las
migraciones 0001–0022 y 0901–0903 están aplicadas en el proyecto de producción;
la 0904 de gobierno de plataforma está pendiente de aplicar y verificar.
El documento conserva el contrato del modelo y se actualiza junto a cada cambio
de esquema. Toda tabla de negocio lleva `tenant_id uuid not null` y RLS forzada
([ADR-0002](./adr/0002-multitenancy-rls.md)).

Convenciones: claves `uuid` con `gen_random_uuid()`; `created_at`/`updated_at`
`timestamptz`; fechas de negocio `date` en la zona del `venue`; importes en
**unidades menores** (enteros), nunca `float`; enums como tipos Postgres.

## Plataforma (sin `tenant_id`)

| Tabla                                | Contenido                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `tenants`                            | `slug` único, nombre, estado (`setup_pending`,`trial`,`active`,`suspended`), `default_locale`, `timezone` |
| `tenant_slug_history`                | Slugs anteriores para redirección                                                                         |
| `platform_members`                   | Operadores Doscientos y su rol global                                                                     |
| `platform_invitations`               | Invitaciones de operador con hash de token, correo, rol, caducidad y aceptación de un solo uso            |
| `platform_audit_log`                 | Bitácora append-only de invitaciones, roles y cambios manuales de estado de tenant                        |
| `support_access_log`                 | Acceso de soporte a un tenant: quién, cuándo, motivo, caducidad                                           |
| `plans` / `plan_entitlements`        | Planes y módulos habilitados por plan                                                                     |
| `subscriptions`                      | Plan del tenant, estado, periodo, vencimiento y gracia                                                    |
| `platform_billing_customers`         | Titular y dirección fiscal a quien SobreTaula factura el SaaS                                             |
| `platform_payment_methods`           | Referencia Redsys cifrada, nunca PAN/CVV ni disponible al cliente                                         |
| `platform_discount_codes`            | Campañas/códigos, vigencia, cupo y aprobación manual                                                      |
| `platform_discount_redemptions`      | Uso auditable y limitado por suscripción                                                                  |
| `platform_subscription_price_phases` | Precio fijo o descuento porcentual por tramo; soporta Founders perpetuo                                   |
| `platform_billing_invoices`          | Recibos SaaS neto/IVA/total y su período                                                                  |
| `platform_payment_attempts`          | Intentos Redsys idempotentes y resultado normalizado                                                      |
| `platform_payment_provider_events`   | Notificaciones Redsys deduplicadas sin payload sensible                                                   |
| `platform_fiscal_settings`           | Emisor, serie y contador propios de las facturas SaaS de SobreTaula                                       |
| `platform_fiscal_invoices`           | Factura fiscal de SobreTaula al restaurante, con snapshots y revisión de incidencias                      |
| `platform_fiscal_outbox`             | Entrega VERI*FACTU del emisor de plataforma; no comparte cadena con ningún tenant                         |

## Identidad de tenant

| Tabla              | Contenido                                                  |
| ------------------ | ---------------------------------------------------------- |
| `profiles`         | Nombre y correo global mínimos, sincronizados desde Auth   |
| `memberships`      | `user_id`, `tenant_id`, `role`, `status`. Unicidad por par |
| `invitations`      | Alta por correo con token de un solo uso y caducidad       |
| `user_preferences` | Locale preferido, ajustes personales                       |
| `venues`           | Local físico del tenant: dirección, `timezone`, aforo      |

Roles de tenant: `owner`, `manager`, `host`, `waiter`, `accountant`. El permiso
efectivo se resuelve en servidor; el rol no se lee del cliente.

## Sala

| Tabla                 | Contenido                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `areas`               | Planta baja, terraza, jardín, privado. Prioridad de asignación, si admite reserva online                  |
| `floor_plan_versions` | Versión inmutable por área: nombre, rango de activación, autor                                            |
| `plan_elements`       | Geometría no-mesa: paredes, aperturas, barra, decoración. `x`,`y`,`w`,`h`,`rotation` en cm/grados enteros |
| `tables`              | Identidad estable de la mesa: `code` (número visible), forma, `min_seats`, `max_seats`, `is_bookable`     |
| `table_placements`    | Posición de una mesa **en una versión** de plano                                                          |
| `table_group_presets` | Combinaciones guardadas para grupos grandes                                                               |

`tables` separa identidad de geometría a propósito: una reserva referencia la
mesa, no su posición, y rediseñar el plano no invalida el histórico.

Unicidad: `unique (tenant_id, venue_id, code)`.

## Reservas

| Tabla                | Contenido                                                                             |
| -------------------- | ------------------------------------------------------------------------------------- |
| `services`           | Turnos: comida, cena, por día de la semana, con hora de inicio/fin                    |
| `availability_rules` | Pacing por intervalo, duración por tamaño de grupo, antelación mínima/máxima, cierres |
| `closures`           | Días o franjas cerradas, por área o por local                                         |
| `guests`             | Comensal: nombre, teléfono, correo, `locale`, notas, alergias                         |
| `reservations`       | `party_size`, `starts_at`, `ends_at`, estado, origen, notas                           |
| `reservation_tables` | Mesas asignadas a una reserva (N mesas por reserva)                                   |
| `holds`              | Bloqueo temporal durante el proceso de reserva, con caducidad                         |
| `waitlist`           | Lista de espera con estimación                                                        |

Estados: `pending`, `confirmed`, `seated`, `completed`, `no_show`, `cancelled`.

**No solapamiento garantizado en la base**, no en JavaScript:

```sql
create extension if not exists btree_gist;

alter table reservation_tables
  add column period tstzrange not null,
  add constraint reservation_tables_no_overlap
  exclude using gist (
    tenant_id with =,
    table_id  with =,
    period    with &&
  ) where (state in ('confirmed', 'seated'));
```

`period` se mantiene coherente con la reserva por trigger. La doble reserva pasa
de ser un bug a ser imposible.

La ampliación pendiente incorpora reglas por área, bloques de programación,
eventos de reserva, tokens de gestión, etiquetas/notas de comensal, espera con
ofertas, outbox de comunicaciones y términos/depósitos de grupo. El diseño de
esas migraciones, su compatibilidad con las tablas actuales y su secuencia viven
en [`reservations-completion-plan.md`](./reservations-completion-plan.md); no se
deben añadir columnas o políticas públicas de forma aislada.

## Servicio y cuenta

| Tabla                            | Contenido                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `table_sessions`                 | Ocupación real: mesas unidas, comensales, apertura/cierre, reserva de origen |
| `menu_categories` / `menu_items` | Catálogo con precio en unidades menores, tipo de IVA e i18n en `jsonb`       |
| `orders` / `order_items`         | Líneas añadidas a la sesión, con precio congelado en el momento              |
| `payments`                       | Cobros de la sesión, método, importe, división de cuenta                     |

Preparado para el TPV completo (comandas a cocina, modificadores, arqueo) sin
cambiar estas tablas: se añaden, no se rehacen.

## Facturación y fiscalidad

| Tabla                    | Contenido                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `tenant_fiscal_settings` | NIF, razón social, domicilio, `verifactu_env`, referencia al secreto del certificado, metadatos y caducidad |
| `fiscal_settings_audit`  | Append-only: alta, reemplazo, revocación, cambio de entorno                                                 |
| `invoice_series`         | Serie y contador por tenant; reserva correlativa transaccional                                              |
| `invoices`               | Snapshot inmutable de la factura emitida                                                                    |
| `invoice_documents`      | PDF en storage privado, create-once                                                                         |
| `verifactu_ledger`       | Cadena append-only por NIF emisor: `chain_sequence`, `previous_hash`, `current_hash`, payload, QR           |
| `verifactu_outbox`       | Una fila por registro del ledger: estado, reintentos, resultado saneado                                     |

Restricciones mínimas: `unique (issuer_nif, chain_sequence)`, ledger sin
`UPDATE` ni `DELETE` (revocado por permisos y por trigger), una fila de outbox
por registro, estados `pending`, `processing`, `retryable_error`, `accepted`,
`rejected`, `terminal_error`.

La cadena de huellas es **por NIF emisor**, jamás compartida entre tenants.
