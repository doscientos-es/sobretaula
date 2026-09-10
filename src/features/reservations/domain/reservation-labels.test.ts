import { describe, expect, it } from 'vitest'

import { reservationStatusLabel } from './reservation-labels'

describe('reservation status labels', () => {
  it('translates known operational states', () => {
    expect(reservationStatusLabel('confirmed')).toBe('Confirmada')
    expect(reservationStatusLabel('no_show')).toBe('No presentada')
  })

  it('keeps unknown states visible for diagnostics', () => {
    expect(reservationStatusLabel('future_state')).toBe('future_state')
  })
})
