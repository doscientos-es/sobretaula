import { describe, expect, it } from 'vitest'

import { zonedLocalToIso } from './zoned-time'
describe('zonedLocalToIso', () => {
  it('converts local restaurant time to UTC', () =>
    expect(zonedLocalToIso('2026-01-15T13:00', 'Europe/Madrid')).toBe('2026-01-15T12:00:00.000Z'))
  it('handles daylight saving time', () =>
    expect(zonedLocalToIso('2026-07-15T13:00', 'Europe/Madrid')).toBe('2026-07-15T11:00:00.000Z'))
})
