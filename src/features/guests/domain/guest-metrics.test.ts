import { describe, expect, it } from 'vitest'

import { calculateGuestMetrics } from './guest-metrics'

describe('calculateGuestMetrics', () => {
  it('counts visits and spend only for closed sessions', () => {
    const result = calculateGuestMetrics(
      [
        { guestId: 'g1', id: 'r1' },
        { guestId: 'g1', id: 'r2' },
      ],
      [
        { guestId: 'g1', id: 's1', status: 'closed' },
        { guestId: 'g1', id: 's2', status: 'open' },
      ],
      [
        { amountCents: 1200, sessionId: 's1' },
        { amountCents: 800, sessionId: 's2' },
      ],
    )
    expect(result.reservationCounts.get('g1')).toBe(2)
    expect(result.visits.get('g1')).toBe(1)
    expect(result.spendCents.get('g1')).toBe(1200)
  })
})
