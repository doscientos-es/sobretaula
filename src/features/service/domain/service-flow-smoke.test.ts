import { describe, expect, it } from 'vitest'

import {
  canAdvanceOrderItemStatus,
  computeAccountTotals,
  splitEvenly,
} from '@/features/account/domain/account'
import { checkAvailability, type AvailabilityRule } from '@/features/reservations'

describe('service flow smoke contract', () => {
  it('covers reservation, kitchen, account, split payment and closure invariants', () => {
    const rule: AvailabilityRule = {
      durationMinutesByParty: { '1-2': 90, '3-4': 105 },
      maxCoversPerSlot: 20,
      maxReservationsPerSlot: 6,
      maxLeadDays: 90,
      minLeadMinutes: 30,
      slotMinutes: 15,
    }
    const startsAt = new Date('2030-05-10T13:30:00.000Z')
    const availability = checkAvailability({
      closures: [],
      now: new Date('2030-05-10T10:00:00.000Z'),
      partySize: 4,
      requestedStartsAt: startsAt,
      reservations: [],
      rule,
      serviceEndsAt: new Date('2030-05-10T16:00:00.000Z'),
      serviceStartsAt: new Date('2030-05-10T13:00:00.000Z'),
      tables: [{ id: 'table-1', isBookable: true, maxSeats: 4, minSeats: 2 }],
    })
    expect(availability.available).toBe(true)
    expect(canAdvanceOrderItemStatus('pending', 'preparing')).toBe(true)
    expect(canAdvanceOrderItemStatus('preparing', 'ready')).toBe(true)
    expect(canAdvanceOrderItemStatus('ready', 'served')).toBe(true)
    const totals = computeAccountTotals(
      [
        {
          id: 'line-1',
          name: 'Menú',
          notes: null,
          quantity: 1,
          unitPriceCents: 4400,
          vatRateBps: 1000,
        },
      ],
      [],
    )
    const parts = splitEvenly(totals.grossCents, 2)
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(totals.grossCents)
    expect(totals.balanceCents).toBe(4400)
  })
})
