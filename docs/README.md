# Documentación de SobreTaula

## Fuentes de verdad

| Documento                                                              | Uso                                                                   | Vigencia                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| [`implementation-status.md`](./implementation-status.md)               | Estado comprobable del código, tests y esquema remoto                 | Vivo; actualizar en cada cierre técnico   |
| [`90-day-remaining-tasks.md`](./90-day-remaining-tasks.md)             | Backlog priorizado para convertir la base actual en producto vendible | Vivo; actualizar al cambiar prioridades   |
| [`project-design.md`](./project-design.md)                             | Producto, arquitectura y contratos no negociables                     | Normativo                                 |
| [`data-model.md`](./data-model.md)                                     | Contrato lógico del esquema y sus invariantes                         | Normativo; actualizar junto a migraciones |
| [`operational-recovery-runbook.md`](./operational-recovery-runbook.md) | Recuperación de sesiones, pagos, caja y Supabase                      | Normativo para operación                  |
| [`client-mvp-gap-analysis.md`](./client-mvp-gap-analysis.md)           | Cumplimiento frente a la petición del cliente                         | Vivo; no sustituye el backlog             |

## Planes de trabajo

- [`mvp-execution-plan.md`](./mvp-execution-plan.md): secuencia detallada de
  entregas técnicas.
- [`room-planner-master-plan.md`](./room-planner-master-plan.md): evolución del
  plano y de la operación de sala.
- [`reservations-completion-plan.md`](./reservations-completion-plan.md):
  reservas públicas, espera, clientes y depósitos.
- [`ux-ui-saas-plan-2026-09-13.md`](./ux-ui-saas-plan-2026-09-13.md): backlog de
  UX/UI de la revisión del 13/09/2026.
- [`mvp-roadmap.md`](./mvp-roadmap.md): hoja de ruta original; se conserva como
  contexto histórico y no debe usarse para elegir el siguiente trabajo si
  contradice el backlog de 90 días o el plan ejecutable.

## Decisiones y requisitos

- [`adr/`](./adr/): decisiones arquitectónicas aceptadas o propuestas.
- [`client-mvp-petition.md`](./client-mvp-petition.md): petición original del
  cliente; es requisito de referencia, no una afirmación de que todo esté
  implementado.
- [`legal/README.md`](./legal/README.md): requisitos para publicar textos
  legales.
- [`redsys-testing.md`](./redsys-testing.md): pruebas sandbox de Redsys.
- [`demo-users.md`](./demo-users.md): cuentas de demostración ya existentes;
  nunca contiene contraseñas.

## Convención de estado

- **Implementado** significa que existe código y cobertura proporcional.
- **Verificado** significa que además hay evidencia reproducible para ese
  entorno concreto.
- **Pendiente** significa que no se ha ejecutado la comprobación o falta una
  pieza funcional.
- **Bloqueado** significa que depende de una aprobación, proveedor, asesoría o
  entorno que el código no puede cerrar por sí solo.

El proyecto Supabase conectado contiene datos existentes. No se usan sus datos
como fixtures, ni se ejecutan allí pruebas de carga, concurrencia, humo o RLS
con usuarios de prueba. Las migraciones locales se revisan individualmente y
solo se aplican cuando el destino está identificado sin ambigüedad.

Las fechas de los documentos son fechas de revisión, no fechas de despliegue.
Cuando una afirmación dependa del esquema remoto debe incluir la evidencia o
decir expresamente que sigue pendiente.
