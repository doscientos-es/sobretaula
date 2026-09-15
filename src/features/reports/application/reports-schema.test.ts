import { describe, expect, it } from 'vitest'

import { salesReportInput } from './reports-schema'

const ids = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  venueId: '00000000-0000-0000-0000-000000000002',
}

describe('salesReportInput', () => {
  it('rejects an inverted reporting period', () => {
    expect(
      salesReportInput.safeParse({
        ...ids,
        from: '2026-09-15T12:00:00.000Z',
        to: '2026-09-15T11:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})
