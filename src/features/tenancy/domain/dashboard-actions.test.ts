import { describe, expect, it } from 'vitest'

import { getDashboardActions } from './dashboard-actions'

describe('getDashboardActions', () => {
  it('prioritizes pending reservations and limits the queue to three items', () => {
    expect(
      getDashboardActions({
        openSessions: [{ id: 'session-1', openedAt: '2026-09-10T12:00:00.000Z', venueId: 'a' }],
        pendingReservations: [
          { id: 'reservation-1', partySize: 2, startsAt: '2026-09-10T13:00:00.000Z', venueId: 'a' },
          { id: 'reservation-2', partySize: 4, startsAt: '2026-09-10T14:00:00.000Z', venueId: 'b' },
          { id: 'reservation-3', partySize: 6, startsAt: '2026-09-10T15:00:00.000Z', venueId: 'b' },
        ],
      }),
    ).toEqual([
      expect.objectContaining({ id: 'reservation-1', kind: 'pending_reservation' }),
      expect.objectContaining({ id: 'reservation-2', kind: 'pending_reservation' }),
      expect.objectContaining({ id: 'reservation-3', kind: 'pending_reservation' }),
    ])
  })
})
