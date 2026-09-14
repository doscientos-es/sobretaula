import { describe, expect, it } from 'vitest'

import { buildReservationsCsv } from './reservation-export'

describe('reservation export', () => {
  it('exports stable, versioned rows and escapes guest data', () => {
    const csv = buildReservationsCsv(
      [
        {
          createdAt: '2026-09-14T10:00:00.000Z',
          email: 'ana@example.com',
          endsAt: '2026-09-14T21:30:00.000Z',
          guestName: 'Ana, Serra',
          guestPhone: '+34 600 000 000',
          id: 'reservation-1',
          partySize: 4,
          source: 'public',
          startsAt: '2026-09-14T20:00:00.000Z',
          status: 'confirmed',
        },
      ],
      { exportedAt: '2026-09-14T12:00:00.000Z', timezone: 'Europe/Madrid' },
    )

    expect(csv.split('\n')[1]).toContain(
      '1,2026-09-14T12:00:00.000Z,Europe/Madrid,reservation-1,"Ana, Serra",ana@example.com',
    )
    expect(csv).not.toContain('table')
    expect(csv).not.toContain('token')
  })
})
