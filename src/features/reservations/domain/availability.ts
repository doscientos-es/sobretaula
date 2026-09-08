export interface AvailabilityRule {
  durationMinutesByParty: Readonly<Record<string, number>>
  maxCoversPerSlot: number | null
  maxReservationsPerSlot: number | null
  maxLeadDays: number
  minLeadMinutes: number
  slotMinutes: number
}

export interface AvailabilityTable {
  id: string
  isBookable: boolean
  maxSeats: number
  minSeats: number
}

export interface ReservationWindow {
  endsAt: Date
  partySize: number
  startsAt: Date
  status: 'confirmed' | 'pending' | 'seated'
  tableIds: readonly string[]
}

export interface ClosureWindow {
  endsAt: Date
  startsAt: Date
}

export type AvailabilityResult =
  | { available: true; endsAt: Date; tableId: string }
  | { available: false; reason: AvailabilityRejectionReason }

export type AvailabilityRejectionReason =
  | 'closed'
  | 'no_table'
  | 'outside_booking_window'
  | 'outside_service'
  | 'pacing_limit'

const blockingStatuses = new Set<ReservationWindow['status']>(['confirmed', 'pending', 'seated'])

export function intervalsOverlap(
  first: Pick<ReservationWindow, 'endsAt' | 'startsAt'>,
  second: Pick<ReservationWindow, 'endsAt' | 'startsAt'>,
): boolean {
  return first.startsAt < second.endsAt && first.endsAt > second.startsAt
}

/** Returns the duration configured for the first party tier that can seat the group. */
export function durationForParty(rule: AvailabilityRule, partySize: number): number {
  const tiers = Object.entries(rule.durationMinutesByParty)
    .map(([party, duration]) => ({ party: Number(party), duration }))
    .filter(({ duration, party }) => Number.isInteger(party) && party > 0 && duration > 0)
    .sort((first, second) => first.party - second.party)
  const tier = tiers.find((current) => partySize <= current.party) ?? tiers.at(-1)
  return tier?.duration ?? 120
}

export function findBestFitTable(
  partySize: number,
  requested: Pick<ReservationWindow, 'endsAt' | 'startsAt'>,
  tables: readonly AvailabilityTable[],
  reservations: readonly ReservationWindow[],
): string | null {
  const occupiedTableIds = new Set(
    reservations
      .filter((reservation) => blockingStatuses.has(reservation.status))
      .filter((reservation) => intervalsOverlap(requested, reservation))
      .flatMap((reservation) => reservation.tableIds),
  )
  return (
    tables
      .filter(
        (table) =>
          table.isBookable &&
          table.minSeats <= partySize &&
          table.maxSeats >= partySize &&
          !occupiedTableIds.has(table.id),
      )
      .sort(
        (first, second) => first.maxSeats - second.maxSeats || first.id.localeCompare(second.id),
      )[0]?.id ?? null
  )
}

function hasPacingCapacity(
  partySize: number,
  startsAt: Date,
  rule: AvailabilityRule,
  reservations: readonly ReservationWindow[],
): boolean {
  const slotStart = new Date(
    Math.floor(startsAt.getTime() / (rule.slotMinutes * 60_000)) * rule.slotMinutes * 60_000,
  )
  const slotEnd = new Date(slotStart.getTime() + rule.slotMinutes * 60_000)
  const inSlot = reservations.filter(
    (reservation) =>
      blockingStatuses.has(reservation.status) &&
      reservation.startsAt >= slotStart &&
      reservation.startsAt < slotEnd,
  )
  const covers = inSlot.reduce((total, reservation) => total + reservation.partySize, partySize)
  return (
    (rule.maxCoversPerSlot === null || covers <= rule.maxCoversPerSlot) &&
    (rule.maxReservationsPerSlot === null || inSlot.length + 1 <= rule.maxReservationsPerSlot)
  )
}

export function checkAvailability({
  closures,
  now,
  partySize,
  requestedStartsAt,
  reservations,
  rule,
  serviceEndsAt,
  serviceStartsAt,
  tables,
}: {
  closures: readonly ClosureWindow[]
  now: Date
  partySize: number
  requestedStartsAt: Date
  reservations: readonly ReservationWindow[]
  rule: AvailabilityRule
  serviceEndsAt: Date
  serviceStartsAt: Date
  tables: readonly AvailabilityTable[]
}): AvailabilityResult {
  const endsAt = new Date(requestedStartsAt.getTime() + durationForParty(rule, partySize) * 60_000)
  const requested = { endsAt, startsAt: requestedStartsAt }
  const minStart = new Date(now.getTime() + rule.minLeadMinutes * 60_000)
  const maxStart = new Date(now.getTime() + rule.maxLeadDays * 86_400_000)
  if (requestedStartsAt < minStart || requestedStartsAt > maxStart) {
    return { available: false, reason: 'outside_booking_window' }
  }
  if (requestedStartsAt < serviceStartsAt || endsAt > serviceEndsAt) {
    return { available: false, reason: 'outside_service' }
  }
  if (closures.some((closure) => intervalsOverlap(requested, closure))) {
    return { available: false, reason: 'closed' }
  }
  if (!hasPacingCapacity(partySize, requestedStartsAt, rule, reservations)) {
    return { available: false, reason: 'pacing_limit' }
  }
  const tableId = findBestFitTable(partySize, requested, tables, reservations)
  return tableId ? { available: true, endsAt, tableId } : { available: false, reason: 'no_table' }
}
