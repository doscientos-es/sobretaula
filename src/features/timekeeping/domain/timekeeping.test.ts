import { describe, expect, it } from 'vitest'
import { allowedNextEvent, workedMinutes } from './timekeeping'
describe('timekeeping', () => {
  it('enforces the basic event state machine', () => { expect(allowedNextEvent(null)).toEqual(['clock_in']); expect(allowedNextEvent('break_start')).toEqual(['break_end']) })
  it('calculates worked time excluding breaks', () => { expect(workedMinutes([{ eventType: 'clock_in', occurredAt: '2026-01-01T10:00:00Z' }, { eventType: 'break_start', occurredAt: '2026-01-01T12:00:00Z' }, { eventType: 'break_end', occurredAt: '2026-01-01T12:30:00Z' }, { eventType: 'clock_out', occurredAt: '2026-01-01T15:00:00Z' }])).toBe(270) })
})
