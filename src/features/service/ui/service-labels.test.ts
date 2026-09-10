import { describe, expect, it } from 'vitest'

import { describeReservationWindow } from './service-labels'

describe('describeReservationWindow', () => {
  const now = new Date('2026-09-10T12:00:00.000Z')

  it('shows urgency for reservations approaching the current service', () => {
    expect(describeReservationWindow('2026-09-10T12:25:00.000Z', now)).toBe('Reserva en 25 min')
    expect(describeReservationWindow('2026-09-10T11:59:00.000Z', now)).toBe('Reserva inminente')
  })

  it('uses a clock label for reservations further away', () => {
    expect(describeReservationWindow('2026-09-10T14:30:00.000Z', now)).toContain('Reserva a las')
    expect(describeReservationWindow('invalid', now)).toBeUndefined()
  })
})
