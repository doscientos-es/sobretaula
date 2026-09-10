import { describe, expect, it, vi } from 'vitest'

import { applyTerraceTransferPlan } from './terrace-transfer'

describe('terrace transfer application', () => {
  it('does not start a transaction when capacity is missing', async () => {
    const transaction = vi.fn()
    await expect(
      applyTerraceTransferPlan({ moves: [], unassignedReservationIds: ['r1'] }, transaction),
    ).rejects.toThrow('capacity_missing')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('requires the transaction to report every move', async () => {
    await expect(
      applyTerraceTransferPlan(
        { moves: [{ reservationId: 'r1', tableIds: ['inside-1'] }], unassignedReservationIds: [] },
        async () => ({ movedReservationIds: [] }),
      ),
    ).rejects.toThrow('incomplete')
  })
})
