import { describe, expect, it } from 'vitest'

import {
  getZonedWeekBounds,
  zonedDateKey,
  zonedDateTimeParts,
  zonedDayBounds,
  zonedLocalToIso,
} from './zoned-time'

describe('zoned time', () => {
  it('converts a local restaurant time to UTC', () => {
    expect(zonedLocalToIso('2026-01-15T13:00', 'Europe/Madrid')).toBe('2026-01-15T12:00:00.000Z')
  })

  it('uses the venue timezone for day and week boundaries across DST', () => {
    expect(getZonedWeekBounds(new Date('2026-07-15T22:30:00.000Z'), 'Europe/Madrid')).toEqual({
      dayEndIso: '2026-07-16T22:00:00.000Z',
      dayStartIso: '2026-07-15T22:00:00.000Z',
      weekEndIso: '2026-07-19T22:00:00.000Z',
      weekStartIso: '2026-07-12T22:00:00.000Z',
    })
  })

  it('uses the restaurant calendar date instead of the server calendar date', () => {
    const value = new Date('2026-09-15T23:30:00.000Z')

    expect(zonedDateKey(value, 'Europe/Madrid')).toBe('2026-09-16')
    expect(zonedDateTimeParts(value, 'Europe/Madrid')).toMatchObject({
      date: '2026-09-16',
      hour: 1,
      minute: 30,
      weekday: 3,
    })
  })

  it('builds UTC bounds for a local calendar day across DST', () => {
    expect(zonedDayBounds('2026-10-25', 'Europe/Madrid')).toEqual({
      dayStartIso: '2026-10-24T22:00:00.000Z',
      dayEndIso: '2026-10-25T23:00:00.000Z',
    })
  })
})
