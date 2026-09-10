import { describe, expect, it } from 'vitest'

import { publicReservationInput } from './public-reservations'

const reservation = {
  email: 'guest@example.com',
  guestName: 'Ana García',
  partySize: 2,
  privacyAccepted: true,
  serviceId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  slug: 'restaurante-demo',
  startsAt: '2026-10-01T12:30:00.000Z',
}

describe('public reservation input', () => {
  it('requires email and privacy acknowledgement', () => {
    expect(publicReservationInput.safeParse(reservation).success).toBe(true)
    expect(publicReservationInput.safeParse({ ...reservation, email: undefined }).success).toBe(
      false,
    )
    expect(
      publicReservationInput.safeParse({ ...reservation, privacyAccepted: false }).success,
    ).toBe(false)
  })

  it('accepts a bounded optional note', () => {
    expect(
      publicReservationInput.safeParse({ ...reservation, notes: 'Sin gluten, por favor.' }).success,
    ).toBe(true)
    expect(
      publicReservationInput.safeParse({ ...reservation, notes: 'a'.repeat(1001) }).success,
    ).toBe(false)
  })
})
