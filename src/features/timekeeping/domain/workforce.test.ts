import { describe, expect, it } from 'vitest'

import { hasShiftOverlap, shiftMinutes } from './workforce'
describe('workforce shifts', () => {
  const shift = {
    employeeId: 'e1',
    startsAt: '2026-09-13T10:00:00Z',
    endsAt: '2026-09-13T18:00:00Z',
    status: 'draft' as const,
  }
  it('calculates planned minutes', () => expect(shiftMinutes(shift)).toBe(480))
  it('detects overlap', () =>
    expect(hasShiftOverlap([shift], { ...shift, startsAt: '2026-09-13T17:00:00Z' })).toBe(true))
  it('allows different employees', () =>
    expect(
      hasShiftOverlap([shift], { ...shift, employeeId: 'e2', startsAt: '2026-09-13T17:00:00Z' }),
    ).toBe(false))
})
