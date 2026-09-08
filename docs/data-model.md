# Modelo de datos

Borrador de F0. Se materializa en `supabase/migrations/` de forma incremental,
una migración pequeña por fase. Toda tabla de negocio lleva `tenant_id uuid not
null` y RLS forzada ([ADR-0002](./adr/0002-multitenancy-rls.md)).

Convenciones: claves `uuid` con `gen_random_uuid()`; `created_at`/`updated_at`
`timestamptz`; fechas de negocio `date` en la zona del `venue`; importes en
**unidades menores** (enteros), nunca `float`; enums como tipos Postgres.

## Plataforma (sin `tenant_id`)

| Tabla                                | Contenido                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `tenants`                            | `slug` único, nombre, estado (`trial`,`active`,`suspended`), `default_locale`, `timezone` |
| `tenant_slug_history`                | Slugs anteriores para redirección                                                         |
| `platform_members`                   | Operadores Doscientos y su rol global                                                     |
| `support_access_log`                 | Acceso de soporte a un tenant: quién, cuándo, motivo, caducidad                           |
| `plans` / `plan_entitlements`        | Planes y módulos habilitados por plan                                                     |
| `subscriptions`                      | Plan del tenant, estado, periodo, vencimiento y gracia                                    |
| `platform_billing_customers`         | Titular y dirección fiscal a quien SobreTaula factura el SaaS                             |
| `platform_payment_methods`           | Referencia Redsys cifrada, nunca PAN/CVV ni disponible al cliente                         |
| `platform_discount_codes`            | Campañas/códigos, vigencia, cupo y aprobación manual                                      |
| `platform_discount_redemptions`      | Uso auditable y limitado por suscripción                                                  |
| `platform_subscription_price_phases` | Precio fijo o descuento porcentual por tramo; soporta Founders perpetuo                   |
| `platform_billing_invoices`          | Recibos SaaS neto/IVA/total y su período                                                  |
| `platform_payment_attempts`          | Intentos Redsys idempotentes y resultado normalizado                                      |
| `platform_payment_provider_events`   | Notificaciones Redsys deduplicadas sin payload sensible                                   |

## Identidad de tenant

| Tabla              | Contenido                                                  |
| ------------------ | ---------------------------------------------------------- |
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
