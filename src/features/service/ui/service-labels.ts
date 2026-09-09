import type { ServiceSession, ServiceTableState, ServiceTableStatus } from '../domain/service-board'

const STATUS_LABEL: Record<ServiceTableStatus, string> = {
  free: 'Libre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
}

export function describeStatus(status: ServiceTableStatus): string {
  return STATUS_LABEL[status]
}

export function tableCodes(
  tables: readonly ServiceTableState[],
  tableIds: readonly string[],
): string {
  return tableIds
    .map((tableId) => tables.find((table) => table.id === tableId)?.code ?? '—')
    .join(', ')
}

export function describeSession(
  session: ServiceSession,
  tables: readonly ServiceTableState[],
): string {
  return `Mesas ${tableCodes(tables, session.tableIds)} · ${session.covers} pax`
}

/** Local time is what the room reads; the date is always today's service. */
export function describeTime(isoDate: string): string {
  const date = new Date(isoDate)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
