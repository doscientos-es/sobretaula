/** Default projection used by pure consumers and tests. */
export const UPCOMING_RESERVATION_WINDOW_MINUTES = 120
/** Operational queue projection: one full shift. */
export const SERVICE_SHIFT_WINDOW_MINUTES = 720

export type ServiceTableStatus = 'free' | 'occupied' | 'reserved'

export interface ServiceTable {
  code: string
  id: string
  maxSeats: number
  minSeats: number
}

export interface ServiceSession {
  covers: number
  id: string
  openedAt: string
  reservationId: string | null
  tableIds: readonly string[]
}

export interface ServiceReservation {
  guestName: string | null
  guestPhone?: string | null
  id: string
  partySize: number
  startsAt: string
  tableIds: readonly string[]
}

export interface WaitlistEntry {
  estimatedWaitMinutes: number | null
  guestName: string | null
  id: string
  partySize: number
  requestedFor: string
}

export interface ServiceTableState extends ServiceTable {
  covers: number | null
  reservationId: string | null
  sessionId: string | null
  status: ServiceTableStatus
}

export interface ServiceBoard {
  reservations: readonly ServiceReservation[]
  sessions: readonly ServiceSession[]
  tables: readonly ServiceTableState[]
  waitlist: readonly WaitlistEntry[]
}

/**
 * Occupancy wins over reservation: a seated party is the truth of the room even
 * if another booking is already approaching for the same table.
 */
export function buildServiceTableStates({
  now,
  reservations,
  sessions,
  tables,
  windowMinutes = UPCOMING_RESERVATION_WINDOW_MINUTES,
}: {
  now: Date
  reservations: readonly ServiceReservation[]
  sessions: readonly ServiceSession[]
  tables: readonly ServiceTable[]
  windowMinutes?: number
}): ServiceTableState[] {
  const windowEnd = now.getTime() + windowMinutes * 60_000
  const occupied = new Map<string, ServiceSession>()
  for (const session of sessions) {
    for (const tableId of session.tableIds) occupied.set(tableId, session)
  }
  const reserved = new Map<string, ServiceReservation>()
  for (const reservation of reservations) {
    const startsAt = new Date(reservation.startsAt).getTime()
    if (Number.isNaN(startsAt) || startsAt > windowEnd) continue
    for (const tableId of reservation.tableIds) {
      const current = reserved.get(tableId)
      if (!current || startsAt < new Date(current.startsAt).getTime()) {
        reserved.set(tableId, reservation)
      }
    }
  }

  return tables.map((table) => {
    const session = occupied.get(table.id)
    if (session) {
      return {
        ...table,
        covers: session.covers,
        reservationId: session.reservationId,
        sessionId: session.id,
        status: 'occupied',
      }
    }
    const reservation = reserved.get(table.id)
    return {
      ...table,
      covers: reservation?.partySize ?? null,
      reservationId: reservation?.id ?? null,
      sessionId: null,
      status: reservation ? 'reserved' : 'free',
    }
  })
}

export function seatingCapacity(
  tables: readonly ServiceTable[],
  tableIds: readonly string[],
): number {
  return tableIds.reduce((total, tableId) => {
    const table = tables.find((candidate) => candidate.id === tableId)
    return total + (table?.maxSeats ?? 0)
  }, 0)
}

/** Returns the codes of the requested tables that another open session already holds. */
export function findSeatingConflicts(
  states: readonly ServiceTableState[],
  tableIds: readonly string[],
  ignoreSessionId?: string,
): string[] {
  return states
    .filter(
      (state) =>
        tableIds.includes(state.id) &&
        state.sessionId !== null &&
        state.sessionId !== ignoreSessionId,
    )
    .map((state) => state.code)
}

/** Union of both table sets, deduplicated and stable, for joining two parties. */
export function mergeTableIds(first: readonly string[], second: readonly string[]): string[] {
  return [...new Set([...first, ...second])]
}
