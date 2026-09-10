export type WeatherCondition = 'clear' | 'rain' | 'storm' | 'strong_wind' | 'heat'

export interface WeatherSnapshot {
  condition: WeatherCondition
  precipitationProbability: number
  windKph: number
  temperatureC: number
}

export interface TerraceWeatherPolicy {
  rainProbabilityThreshold: number
  windKphThreshold: number
  heatCThreshold: number
}

export type TerraceWeatherAction = 'keep_outdoor' | 'move_inside' | 'review'

export interface TerraceReservation {
  id: string
  covers: number
  tableIds: readonly string[]
}

export interface TerraceTransferPlan {
  moves: Array<{ reservationId: string; tableIds: string[] }>
  unassignedReservationIds: string[]
}
export interface TerraceClosurePlan {
  canClose: boolean
  activeSessionIds: string[]
  reservationIds: string[]
}

const DEFAULT_POLICY: TerraceWeatherPolicy = {
  rainProbabilityThreshold: 45,
  windKphThreshold: 35,
  heatCThreshold: 35,
}

export function decideTerraceWeatherAction(
  snapshot: WeatherSnapshot,
  policy: TerraceWeatherPolicy = DEFAULT_POLICY,
): TerraceWeatherAction {
  if (
    snapshot.condition === 'storm' ||
    snapshot.condition === 'rain' ||
    snapshot.precipitationProbability >= policy.rainProbabilityThreshold ||
    snapshot.windKph >= policy.windKphThreshold
  )
    return 'move_inside'
  if (snapshot.condition === 'heat' || snapshot.temperatureC >= policy.heatCThreshold)
    return 'review'
  return 'keep_outdoor'
}

export function shouldReviewTerraceTransfer(
  snapshot: WeatherSnapshot,
  policy?: TerraceWeatherPolicy,
): boolean {
  return decideTerraceWeatherAction(snapshot, policy) !== 'keep_outdoor'
}

/** Assigns reservations to unused indoor tables without mutating live state. */
export function planTerraceTransfer(
  reservations: readonly TerraceReservation[],
  indoorTables: readonly { id: string; capacity: number }[],
  occupiedIndoorTableIds: readonly string[] = [],
): TerraceTransferPlan {
  const occupied = new Set(occupiedIndoorTableIds)
  const moves: TerraceTransferPlan['moves'] = []
  const unassignedReservationIds: string[] = []
  for (const reservation of [...reservations].sort(
    (a, b) => b.covers - a.covers || a.id.localeCompare(b.id),
  )) {
    const candidate = indoorTables
      .filter((table) => !occupied.has(table.id) && table.capacity >= reservation.covers)
      .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id))[0]
    if (!candidate) {
      unassignedReservationIds.push(reservation.id)
      continue
    }
    occupied.add(candidate.id)
    moves.push({ reservationId: reservation.id, tableIds: [candidate.id] })
  }
  return { moves, unassignedReservationIds }
}

export function planTerraceClosure(input: {
  activeSessions: readonly { id: string; tableIds: readonly string[] }[]
  reservations: readonly { id: string; tableIds: readonly string[] }[]
  terraceTableIds: readonly string[]
}): TerraceClosurePlan {
  const terraceIds = new Set(input.terraceTableIds)
  const activeSessionIds = input.activeSessions
    .filter((session) => session.tableIds.some((tableId) => terraceIds.has(tableId)))
    .map((session) => session.id)
  const reservationIds = input.reservations
    .filter((reservation) => reservation.tableIds.some((tableId) => terraceIds.has(tableId)))
    .map((reservation) => reservation.id)
  return {
    canClose: activeSessionIds.length === 0 && reservationIds.length === 0,
    activeSessionIds,
    reservationIds,
  }
}
