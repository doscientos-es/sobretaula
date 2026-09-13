import { describe, expect, it } from 'vitest'

import { publicReservationFailure } from './public-reservation-error'

describe('publicReservationFailure', () => {
  it.each([
    [new Response(null, { status: 409 }), 'slotTaken'],
    [{ statusCode: 429 }, 'rateLimited'],
    [new Error('Terms version unavailable'), 'termsUnavailable'],
    [new Error('ZodError: invalid_type'), 'detailsInvalid'],
  ] as const)('keeps expected server failures actionable', (error, expected) => {
    expect(publicReservationFailure(error)).toBe(expected)
  })
})