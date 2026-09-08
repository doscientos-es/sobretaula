import { describe, expect, it } from 'vitest'

import {
  checkAvailability,
  durationForParty,
  findBestFitTable,
  type AvailabilityRule,
} from './availability'

const at = (time: string) => new Date(`2026-09-10T${time}:00.000Z`)
const rule: AvailabilityRule = {
  durationMinutesByParty: { 2: 90, 4: 120 },
  maxCoversPerSlot: 8,
  maxLeadDays: 30,
  maxReservationsPerSlot: 2,
  minLeadMinutes: 30,
  slotMinutes: 15,
}
const tables = [
  { id: 'large', isBookable: true, maxSeats: 6, minSeats: 1 },
  { id: 'small', isBookable: true, maxSeats: 2, minSeats: 1 },
]

describe('reservation availability', () => {
  it('selects a smallest free table and duration tier', () => {
    expect(durationForParty(rule, 3)).toBe(120)
    expect(findBestFitTable(2, { endsAt: at('15:00'), startsAt: at('13:00') }, tables, [])).toBe(
      'small',
    )
  })

  it('rejects overlaps, pacing limits, closures and invalid service windows', () => {
    const shared = {
      closures: [],
      now: at('11:00'),
      partySize: 2,
      requestedStartsAt: at('13:00'),
      rule,
      serviceEndsAt: at('16:00'),
      serviceStartsAt: at('12:00'),
      tables,
    }
    expect(checkAvailability({ ...shared, reservations: [] })).toMatchObject({
      available: true,
      tableId: 'small',
    })
    expect(
      checkAvailability({
        ...shared,
        closures: [{ endsAt: at('14:00'), startsAt: at('12:30') }],
        reservations: [],
      }),
    ).toMatchObject({ reason: 'closed' })
    expect(
      checkAvailability({ ...shared, requestedStartsAt: at('15:00'), reservations: [] }),
    ).toMatchObject({ reason: 'outside_service' })
    expect(
      checkAvailability({
        ...shared,
        reservations: [
          {
            endsAt: at('15:00'),
            partySize: 4,
            startsAt: at('13:00'),
            status: 'confirmed',
            tableIds: ['small'],
          },
          {
            endsAt: at('15:00'),
            partySize: 4,
            startsAt: at('13:00'),
            status: 'pending',
            tableIds: ['large'],
          },
        ],
      }),
    ).toMatchObject({ reason: 'pacing_limit' })
  })
})
