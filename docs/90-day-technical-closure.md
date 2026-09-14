# Cierre técnico del plan de 90 días

Última revisión: 2026-09-14. Alcance: restaurante independiente con sala,
navegador/tablet y exportaciones. Este documento no añade funcionalidades;
consolida el estado de las superficies existentes y sus gates.

## Estado vendible local

| Área                             | Estado | Evidencia o cierre necesario                                                                                                                                    |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta, tenant, roles y activación | [x]    | Onboarding, equipo, entitlements y acceso por servidor implementados.                                                                                           |
| Reservas internas y públicas     | [x]    | Agenda, disponibilidad, gestión tokenizada, condiciones versionadas, rate limit, espera y recordatorio implementados. Falta solo smoke autenticado aislado.     |
| Sala                             | [x]    | Plano, sentar/mover/unir, walk-in, no-show, mesas bloqueadas, limpieza, pacing y handover implementados.                                                        |
| TPV, comandas y cocina/barra     | [x]    | Entrada TPV única, catálogo, estaciones, cola KDS, estados, notas y reintentos idempotentes implementados en web/tablet.                                        |
| Cuenta, pagos y caja             | [x]    | Pagos mixtos idempotentes, devoluciones, conciliación, arqueo, cierre y reimpresión web implementados. Hardware no forma parte del MVP.                         |
| Fichaje y exportaciones          | [x]    | PIN/terminal, pausas, jornadas, auditoría, exportación CSV y exportaciones operativas existentes implementados de forma indicativa.                             |
| Producto, carta e importación    | [~]    | Ingredientes, escandallos, alérgenos, canales, carta e importación con preview implementados; falta cerrar validación visual y flujo punta a punta.             |
| Fiscalidad                       | [~]    | Ticket, factura, rectificativa y ledger en modo test; producción VERI*FACTU permanece bloqueada hasta el gate fiscal.                                           |
| Accesibilidad                    | [~]    | Estados, controles nativos de archivo, navegación y foco cubiertos en código; falta auditoría manual AA y recorrido con teclado/lector en dispositivo objetivo. |

## Gates separados

Estos puntos no se pueden marcar como hechos por un build local:

- **G1 Seguridad/RLS remota:** ejecutar suite aislada contra un entorno de
  pruebas, cubriendo tenant, local, rol, Storage, doble reserva, doble cobro,
  reintento y recuperación. No usar el proyecto con datos reales para fixtures,
  carga o concurrencia.
- **G2 Migraciones y despliegue:** comparar primero el historial remoto de
  `schema_migrations` por las colisiones históricas; después aplicar solo
  migraciones revisadas y verificar esquema. Despliegue autorizado pendiente.
- **G3 Asesoría:** confirmar convenio, conservación y formato de inspección del
  registro horario, además de identidad fiscal, series, certificado y adaptador
  AEAT antes de activar VERI*FACTU en producción.
- **G4 Piloto:** restaurante consentido, formación, soporte, feature flags,
  multidispositivo, corte de red, servicio completo y aprobación explícita.
- **G5 Privacidad y comunicaciones:** validar retención, exportación,
  anonimización y permisos de datos sensibles; proveedor/consentimiento para
  SMS o WhatsApp. El email puede validarse por separado.
- **G6 TPV/hardware:** decisión comercial sobre integración o exportación
  temporal. Impresora, cajón y datáfono físico quedan fuera del MVP actual.

## Evidencia local de esta revisión

`pnpm quality` y la repetición con `pnpm test -- --maxWorkers=1` pasan formato,
estructura, tipos y **419 tests pasados / 3 omitidos**. Se corrigió además la
dependencia omitida de `venueId` en la carga de ingredientes para evitar reutilizar
datos al cambiar de local.

Un resultado verde local no certifica RLS remoto, migraciones desplegadas,
VERI*FACTU productivo, legalidad laboral, accesibilidad manual ni piloto.
