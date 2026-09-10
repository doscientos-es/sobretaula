import { describe, expect, it } from 'vitest'

import { allowedNextEvent, summarizeLaborTime, workedMinutes } from './timekeeping'
describe('timekeeping', () => {
  it('enforces the basic event state machine', () => {
    expect(allowedNextEvent(null)).toEqual(['clock_in'])
    expect(allowedNextEvent('break_start')).toEqual(['break_end'])
  })
  it('calculates worked time excluding breaks', () => {
    expect(
      workedMinutes([
        { eventType: 'clock_in', occurredAt: '2026-01-01T10:00:00Z' },
        { eventType: 'break_start', occurredAt: '2026-01-01T12:00:00Z' },
        { eventType: 'break_end', occurredAt: '2026-01-01T12:30:00Z' },
        { eventType: 'clock_out', occurredAt: '2026-01-01T15:00:00Z' },
      ]),
    ).toBe(270)
  })
  it('attributes overnight and holiday minutes using the venue timezone', () => {
    const summary = summarizeLaborTime({
      employmentType: 'full_time',
      events: [
        { eventType: 'clock_in', occurredAt: '2026-01-01T20:00:00.000Z' },
        { eventType: 'clock_out', occurredAt: '2026-01-02T06:00:00.000Z' },
      ],
      holidayDates: ['2026-01-02'],
      timeZone: 'Europe/Madrid',
    })
    expect(summary.workedMinutes).toBe(600)
    expect(summary.nightMinutes).toBe(480)
    expect(summary.holidayMinutes).toBe(420)
  })
  it('flags insufficient rest and classifies part-time daily excess as complementary', () => {
    const summary = summarizeLaborTime({
      employmentType: 'part_time',
      events: [
        { eventType: 'clock_in', occurredAt: '2026-01-01T08:00:00.000Z' },
        { eventType: 'clock_out', occurredAt: '2026-01-01T15:00:00.000Z' },
        { eventType: 'clock_in', occurredAt: '2026-01-01T20:00:00.000Z' },
        { eventType: 'clock_out', occurredAt: '2026-01-01T22:00:00.000Z' },
      ],
      rules: {
        dailyTargetMinutes: 240,
        minimumBreakMinutes: 15,
        minimumDailyRestMinutes: 720,
        nightEndsAt: '06:00',
        nightStartsAt: '22:00',
      },
      timeZone: 'Europe/Madrid',
    })
    expect(summary.complementaryMinutes).toBe(300)
    expect(summary.breakViolationCount).toBe(1)
    expect(summary.restViolationCount).toBe(1)
    expect(summary.splitShiftDays).toBe(1)
  })
})
