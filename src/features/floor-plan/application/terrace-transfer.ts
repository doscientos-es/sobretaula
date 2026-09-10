import type { TerraceTransferPlan } from '../domain/weather-policy'

export interface TerraceTransferTransactionResult {
  movedReservationIds: string[]
}

/** Applies a previously reviewed plan through one caller-owned transaction. */
export async function applyTerraceTransferPlan(
  plan: TerraceTransferPlan,
  transaction: (
    moves: readonly TerraceTransferPlan['moves'][number][],
  ) => Promise<TerraceTransferTransactionResult>,
): Promise<TerraceTransferTransactionResult> {
  if (plan.unassignedReservationIds.length > 0)
    throw new Error(`terrace_transfer_capacity_missing:${plan.unassignedReservationIds.join(',')}`)
  if (plan.moves.length === 0) return { movedReservationIds: [] }
  const result = await transaction(plan.moves)
  if (result.movedReservationIds.length !== plan.moves.length)
    throw new Error('terrace_transfer_incomplete')
  return result
}
