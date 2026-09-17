import { describe, expect, it } from 'vitest'

import { buildWeeklyShiftPeriods, hasShiftOverlap, shiftMinutes } from './workforce'
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
  it('builds one shift per selected weekday in the reference week', () => {
    const periods = buildWeeklyShiftPeriods({
      endsAt: '17:00',
      referenceDate: '2026-09-16',
      startsAt: '09:00',
      weekdays: [1, 3, 5],
    })
    expect(periods).toHaveLength(3)
    expect(periods.map((period) => period.startsAt.slice(0, 10))).toEqual([
      '2026-09-14',
      '2026-09-16',
      '2026-09-18',
    ])
    expect(
      periods.every(
        (period) =>
          new Date(period.endsAt).getTime() - new Date(period.startsAt).getTime() ===
          8 * 60 * 60_000,
      ),
    ).toBe(true)
  })
})
