import { describe, expect, it } from 'vitest'

import {
  recordOfflineTimeEventInput,
  terminalTimeEventInput,
  timekeepingHolidayInput,
  timekeepingTermInput,
} from './timekeeping-schema'

const event = {
  employeeId: '00000000-0000-4000-8000-000000000001',
  eventType: 'clock_in',
  pin: '1234',
  tenantId: '00000000-0000-4000-8000-000000000002',
  venueId: '00000000-0000-4000-8000-000000000003',
}

describe('terminalTimeEventInput', () => {
  it('requires a stable terminal identifier for PIN-based clocking', () => {
    expect(terminalTimeEventInput.safeParse(event).success).toBe(false)
    expect(
      terminalTimeEventInput.safeParse({ ...event, terminalId: 'front-counter-1' }).success,
    ).toBe(true)
  })
})

describe('recordOfflineTimeEventInput', () => {
  it('requires a UUID operation and an ISO client timestamp', () => {
    expect(
      recordOfflineTimeEventInput.safeParse({
        clientOccurredAt: '2026-01-01T10:00:00.000Z',
        employeeId: event.employeeId,
        eventType: 'clock_in',
        operationId: '00000000-0000-4000-8000-000000000004',
        tenantId: event.tenantId,
        venueId: event.venueId,
      }).success,
    ).toBe(true)
    expect(
      recordOfflineTimeEventInput.safeParse({
        clientOccurredAt: 'not-a-date',
        employeeId: event.employeeId,
        eventType: 'clock_in',
        operationId: 'not-a-uuid',
        tenantId: event.tenantId,
        venueId: event.venueId,
      }).success,
    ).toBe(false)
  })
})

describe('timekeeping configuration inputs', () => {
  it('accepts bounded labor terms and rejects invalid clock values', () => {
    const input = {
      dailyTargetMinutes: 480,
      effectiveFrom: '2026-01-01',
      employeeId: event.employeeId,
      employmentType: 'full_time',
      minimumBreakMinutes: 15,
      minimumDailyRestMinutes: 720,
      nightEndsAt: '06:00',
      nightStartsAt: '22:00',
      tenantId: event.tenantId,
      venueId: event.venueId,
    }
    expect(timekeepingTermInput.safeParse(input).success).toBe(true)
    expect(timekeepingTermInput.safeParse({ ...input, nightStartsAt: '25:00' }).success).toBe(false)
  })

  it('requires a dated, named holiday', () => {
    const input = {
      holidayDate: '2026-12-25',
      label: 'Navidad',
      tenantId: event.tenantId,
      venueId: event.venueId,
    }
    expect(timekeepingHolidayInput.safeParse(input).success).toBe(true)
    expect(timekeepingHolidayInput.safeParse({ ...input, label: ' ' }).success).toBe(false)
  })
})
