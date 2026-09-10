/** Default projection used by pure consumers and tests. */
export const UPCOMING_RESERVATION_WINDOW_MINUTES = 120
/** Operational queue projection: one full shift. */
export const SERVICE_SHIFT_WINDOW_MINUTES = 720

export type ServiceTableStatus = 'free' | 'occupied' | 'reserved' | 'blocked' | 'cleaning'

export interface ServiceTable {
  areaId?: string
  blockReason?: string | null
  isBlocked?: boolean
  isPendingCleaning?: boolean
  isAccessible?: boolean
  code: string
  id: string
  maxSeats: number
  minSeats: number
}

export interface ServiceTableGroupPreset {
  id: string
  maxSeats: number
  name: string
  tableIds: string[]
}

export interface ServiceStaffMember {
  displayName: string
  role: 'host' | 'manager' | 'owner' | 'waiter'
  userId: string
}

export interface ServiceHandoverSnapshot {
  createdAt: string
  createdBy: string
  createdByName?: string
  id: string
  summary: readonly ServiceHandoverSection[]
}

export interface ServicePresetPreflight {
  capacity: number
  missingTableIds: string[]
  reason: 'available' | 'missing_tables' | 'occupied' | 'over_capacity'
  tableIds: string[]
}

export interface ServiceSession {
  covers: number
  id: string
  internalNote?: string | null
  openedAt: string
  reservationId: string | null
  tableIds: readonly string[]
}

export interface ServiceReservation {
  guestName: string | null
  guestPhone?: string | null
  id: string
  partySize: number
  preferences?: readonly string[]
  startsAt: string
  tableIds: readonly string[]
}

export interface WaitlistEntry {
  estimatedWaitMinutes: number | null
  guestName: string | null
  guestPhone?: string | null
  id: string
  partySize: number
  requestedFor: string
}

export interface KitchenTicket {
  id: string
  name: string
  notes: string | null
  quantity: number
  preparationMinutes: number
  station: string
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled'
  sessionId: string
  createdAt: string
}

export interface ServiceTableState extends ServiceTable {
  covers: number | null
  nextReservationStartsAt?: string
  reservationStartsAt?: string
  reservationId: string | null
  sessionId: string | null
  status: ServiceTableStatus
}

export interface ServiceBoard {
  areaStaffAssignments?: Readonly<Record<string, readonly string[]>>
  reservations: readonly ServiceReservation[]
  sessions: readonly ServiceSession[]
  pacingTargetMinutes?: number
  kitchenLoad?: number
  kitchenAlertOrderCount?: number
  kitchenAlertMinutes?: number
  kitchenLoadByStation?: Readonly<Record<string, number>>
  kitchenTickets?: readonly KitchenTicket[]
  staff?: readonly ServiceStaffMember[]
  handoverSnapshots?: readonly ServiceHandoverSnapshot[]
  tables: readonly ServiceTableState[]
  tableGroupPresets?: readonly ServiceTableGroupPreset[]
  waitlist: readonly WaitlistEntry[]
}

export function kitchenLoadState(
  recentOrderCount: number,
  alertThreshold = 12,
): 'normal' | 'attention' {
  return recentOrderCount >= alertThreshold ? 'attention' : 'normal'
}

export function kitchenStationLoadState(
  load: Readonly<Record<string, number>>,
  threshold = 6,
): Readonly<Record<string, 'normal' | 'attention'>> {
  return Object.fromEntries(
    Object.entries(load).map(([station, count]) => [
      station,
      count >= threshold ? 'attention' : 'normal',
    ]),
  )
}

/** Minutes elapsed since a party was seated, clamped for invalid clocks. */
export function sessionElapsedMinutes(session: ServiceSession, now: Date): number {
  const opened = new Date(session.openedAt).getTime()
  if (!Number.isFinite(opened)) return 0
  return Math.max(0, Math.floor((now.getTime() - opened) / 60_000))
}

export function sessionPacingState(
  session: ServiceSession,
  now: Date,
  targetMinutes = 90,
): 'on_track' | 'attention' {
  return sessionElapsedMinutes(session, now) > targetMinutes ? 'attention' : 'on_track'
}

export interface ServiceHandoverSection {
  activeSessions: number
  assignedStaffIds: readonly string[]
  attentionSessions: number
  areaId: string
  blockedTables: number
  cleaningTables: number
}

/** Builds a compact, deterministic handover snapshot for the next shift. */
export function buildServiceHandover(board: ServiceBoard, now: Date): ServiceHandoverSection[] {
  const areaIds = new Set(
    board.tables.map((table) => table.areaId).filter((id): id is string => Boolean(id)),
  )
  return [...areaIds].map((areaId) => {
    const areaTables = board.tables.filter((table) => table.areaId === areaId)
    const sessionIds = new Set(
      areaTables.map((table) => table.sessionId).filter((id): id is string => Boolean(id)),
    )
    const sessions = board.sessions.filter((session) => sessionIds.has(session.id))
    return {
      activeSessions: sessions.length,
      assignedStaffIds: board.areaStaffAssignments?.[areaId] ?? [],
      attentionSessions: sessions.filter(
        (session) =>
          sessionPacingState(session, now, board.pacingTargetMinutes ?? 90) === 'attention',
      ).length,
      areaId,
      blockedTables: areaTables.filter((table) => table.status === 'blocked').length,
      cleaningTables: areaTables.filter((table) => table.status === 'cleaning').length,
    }
  })
}

export interface ServiceHandoverDelta extends ServiceHandoverSection {
  activeSessionsDelta: number
  attentionSessionsDelta: number
  blockedTablesDelta: number
  cleaningTablesDelta: number
}

/** Compares a saved handover with the current snapshot by area. */
export function compareServiceHandover(
  saved: readonly ServiceHandoverSection[],
  current: readonly ServiceHandoverSection[],
): ServiceHandoverDelta[] {
  const currentByArea = new Map(current.map((section) => [section.areaId, section]))
  const areaIds = new Set([...saved.map((section) => section.areaId), ...currentByArea.keys()])
  return [...areaIds].map((areaId) => {
    const section = currentByArea.get(areaId) ?? {
      activeSessions: 0,
      assignedStaffIds: [],
      attentionSessions: 0,
      areaId,
      blockedTables: 0,
      cleaningTables: 0,
    }
    const previous = saved.find((candidate) => candidate.areaId === areaId)
    return {
      ...section,
      activeSessionsDelta: section.activeSessions - (previous?.activeSessions ?? 0),
      attentionSessionsDelta: section.attentionSessions - (previous?.attentionSessions ?? 0),
      blockedTablesDelta: section.blockedTables - (previous?.blockedTables ?? 0),
      cleaningTablesDelta: section.cleaningTables - (previous?.cleaningTables ?? 0),
    }
  })
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
    if (Number.isNaN(startsAt)) continue
    for (const tableId of reservation.tableIds) {
      const current = reserved.get(tableId)
      if (!current || startsAt < new Date(current.startsAt).getTime()) {
        reserved.set(tableId, reservation)
      }
    }
  }

  return tables.map((table) => {
    if (table.isBlocked) {
      return { ...table, covers: null, reservationId: null, sessionId: null, status: 'blocked' }
    }
    if (table.isPendingCleaning) {
      return { ...table, covers: null, reservationId: null, sessionId: null, status: 'cleaning' }
    }
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
    const startsAt = reservation ? new Date(reservation.startsAt).getTime() : Number.NaN
    const withinWindow = Number.isFinite(startsAt) && startsAt <= windowEnd
    return {
      ...table,
      covers: withinWindow ? (reservation?.partySize ?? null) : null,
      ...(withinWindow && reservation
        ? { reservationId: reservation.id }
        : { reservationId: null }),
      ...(withinWindow && reservation ? { reservationStartsAt: reservation.startsAt } : {}),
      ...(reservation ? { nextReservationStartsAt: reservation.startsAt } : {}),
      sessionId: null,
      status: withinWindow && reservation ? 'reserved' : 'free',
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

export function inspectServiceTableGroupPreset(
  preset: ServiceTableGroupPreset,
  tables: readonly ServiceTableState[],
): ServicePresetPreflight {
  const states = preset.tableIds
    .map((id) => tables.find((table) => table.id === id))
    .filter((table): table is ServiceTableState => Boolean(table))
  const missingTableIds = preset.tableIds.filter((id) => !states.some((table) => table.id === id))
  const capacity = states.reduce((total, table) => total + table.maxSeats, 0)
  const reason =
    missingTableIds.length > 0
      ? 'missing_tables'
      : states.some((table) => table.status !== 'free')
        ? 'occupied'
        : capacity > preset.maxSeats
          ? 'over_capacity'
          : 'available'
  return { capacity, missingTableIds, reason, tableIds: preset.tableIds }
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

export type SessionSplitPlan =
  | { ok: true; remainingTableIds: string[] }
  | { ok: false; reason: 'empty_selection' | 'unknown_table' | 'all_tables' | 'invalid_covers' }

/** Pure validation for splitting a session before any account mutation occurs. */
export function planSessionSplit(
  session: Pick<ServiceSession, 'covers' | 'tableIds'>,
  selectedTableIds: readonly string[],
  newCovers: number,
): SessionSplitPlan {
  if (selectedTableIds.length === 0) return { ok: false, reason: 'empty_selection' }
  if (selectedTableIds.some((tableId) => !session.tableIds.includes(tableId)))
    return { ok: false, reason: 'unknown_table' }
  const selected = new Set(selectedTableIds)
  const remainingTableIds = session.tableIds.filter((tableId) => !selected.has(tableId))
  if (remainingTableIds.length === 0) return { ok: false, reason: 'all_tables' }
  if (!Number.isInteger(newCovers) || newCovers < 1 || newCovers >= session.covers)
    return { ok: false, reason: 'invalid_covers' }
  return { ok: true, remainingTableIds }
}

/** Suggests the smallest free-table combination that fits a party. */
export function suggestTableCombination(
  states: readonly ServiceTableState[],
  covers: number,
  areaId?: string,
  accessibleOnly = false,
  now = new Date(),
  reservationBufferMinutes = 120,
  areaLoads: Readonly<Record<string, number>> = {},
  preferences: readonly string[] = [],
  kitchenLoads: Readonly<Record<string, number>> = {},
): string[] | undefined {
  if (!Number.isInteger(covers) || covers <= 0) return undefined
  const available = states.filter(
    (state) =>
      state.status === 'free' &&
      (!areaId || state.areaId === areaId) &&
      (!accessibleOnly || state.isAccessible === true),
  )
  const protectedUntil = now.getTime() + reservationBufferMinutes * 60_000
  const safeAvailable = available.filter((state) => {
    if (!state.nextReservationStartsAt) return true
    const startsAt = new Date(state.nextReservationStartsAt).getTime()
    return !Number.isFinite(startsAt) || startsAt >= protectedUntil
  })
  const candidates = safeAvailable.length >= 1 ? safeAvailable : available
  const combinationLoad = (chosen: readonly ServiceTableState[]) =>
    chosen.reduce((total, table) => total + (table.areaId ? (areaLoads[table.areaId] ?? 0) : 0), 0)
  const combinationKitchenLoad = (chosen: readonly ServiceTableState[]) =>
    chosen.reduce(
      (total, table) => total + (table.areaId ? (kitchenLoads[table.areaId] ?? 0) : 0),
      0,
    )
  const preferredAreas = new Set(
    preferences.flatMap((preference) => {
      const normalized = preference.trim().toLowerCase()
      return normalized.startsWith('area:') ? [normalized.slice(5)] : [normalized]
    }),
  )
  const preferenceScore = (chosen: readonly ServiceTableState[]) =>
    chosen.reduce(
      (total, table) =>
        total + (table.areaId && preferredAreas.has(table.areaId.toLowerCase()) ? 1 : 0),
      0,
    )
  let best: ServiceTableState[] | undefined
  const visit = (start: number, chosen: ServiceTableState[], capacity: number) => {
    const bestCapacity = best?.reduce((sum, table) => sum + table.maxSeats, 0)
    let betterTie = false
    if (best) {
      const preferenceDelta = preferenceScore(chosen) - preferenceScore(best)
      const kitchenDelta = combinationKitchenLoad(chosen) - combinationKitchenLoad(best)
      const areaDelta = combinationLoad(chosen) - combinationLoad(best)
      betterTie =
        chosen.length < best.length ||
        (chosen.length === best.length &&
          (preferenceDelta > 0 ||
            (preferenceDelta === 0 && (kitchenDelta < 0 || (kitchenDelta === 0 && areaDelta < 0)))))
    }
    if (
      capacity >= covers &&
      (!best ||
        (bestCapacity !== undefined && capacity - covers < bestCapacity - covers) ||
        (bestCapacity !== undefined && capacity === bestCapacity && betterTie))
    )
      best = chosen
    if (chosen.length >= 6 || capacity >= covers) return
    for (let index = start; index < candidates.length; index += 1) {
      const candidate = candidates[index]
      if (candidate) visit(index + 1, [...chosen, candidate], capacity + candidate.maxSeats)
    }
  }
  visit(0, [], 0)
  return best?.map((table) => table.id)
}
