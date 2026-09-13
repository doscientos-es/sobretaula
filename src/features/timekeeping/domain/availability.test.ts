import { describe, expect, it } from 'vitest'

import { isEmployeeAvailable } from './availability'
describe('employee availability', () => {
  const shift = {
    employeeId: 'e1',
    startsAt: '2026-09-14T10:00:00Z',
    endsAt: '2026-09-14T18:00:00Z',
    status: 'draft' as const,
  }
  it('accepts a shift inside the weekly window', () =>
    expect(
      isEmployeeAvailable(
        shift,
        [{ weekday: 1, startsAt: '09:00', endsAt: '20:00', available: true }],
        [],
      ),
    ).toBe(true))
  it('rejects approved absence', () =>
    expect(
      isEmployeeAvailable(
        shift,
        [{ weekday: 1, startsAt: '09:00', endsAt: '20:00', available: true }],
        [{ startsAt: '2026-09-14', endsAt: '2026-09-14', status: 'approved' }],
      ),
    ).toBe(false))
})
