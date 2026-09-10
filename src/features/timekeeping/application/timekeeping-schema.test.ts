import { describe, expect, it } from 'vitest'

import { terminalTimeEventInput } from './timekeeping-schema'

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
