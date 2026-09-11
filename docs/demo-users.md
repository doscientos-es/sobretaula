# Cuentas demo para presentar Sobretaula

Estas cuentas ya existen en el proyecto Supabase autorizado y están asociadas
al tenant `la-fonda-demo`, que tiene un local de demostración. No se guardan
contraseñas en el repositorio: si una cuenta no tiene una contraseña conocida,
se debe usar el flujo de recuperación o una invitación de equipo.

| Cuenta                            | Rol       | Uso recomendado                                    |
| --------------------------------- | --------- | -------------------------------------------------- |
| `gubaupol+demo-owner@gmail.com`   | `owner`   | Configuración, carta, caja, informes y facturación |
| `gubaupol+demo-manager@gmail.com` | `manager` | Operación diaria y gestión del equipo              |
| `gubaupol+demo-staff@gmail.com`   | `waiter`  | Servicio, cuentas y comandas                       |

## Cuentas de escenarios existentes

También hay cuentas asociadas a los tenants de ejemplo `pocafoc` y
`pocafoc-restaurant`, útiles para revisar estados de tenant y onboarding:

| Cuenta                                        | Rol     | Tenant               |
| --------------------------------------------- | ------- | -------------------- |
| `gubaupol+pocafoc-admin@gmail.com`            | `owner` | `pocafoc`            |
| `gubaupol+sobretaula-pocafoc-owner@gmail.com` | `owner` | `pocafoc-restaurant` |

La ausencia de filas en `membership_venues` conserva la semántica actual de
acceso a todos los locales del tenant. La lista se verificó por metadatos y
relaciones de Auth/membresías sin leer contraseñas ni crear fixtures nuevos en
producción.
