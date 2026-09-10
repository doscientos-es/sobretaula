import { describe, expect, it } from 'vitest'

import { dashboardMetricsInput } from './dashboard-metrics'

describe('dashboardMetricsInput', () => {
  it('defaults missing venue ids for older route bundles', () => {
    expect(
      dashboardMetricsInput.parse({
        tenantId: '00000000-0000-0000-0000-000000000001',
      }),
    ).toEqual({
      tenantId: '00000000-0000-0000-0000-000000000001',
      venueIds: [],
    })
  })

  it('keeps the venue ids supplied by the current route', () => {
    const venueId = '00000000-0000-0000-0000-000000000002'
    expect(
      dashboardMetricsInput.parse({
        tenantId: '00000000-0000-0000-0000-000000000001',
        venueIds: [venueId],
      }).venueIds,
    ).toEqual([venueId])
  })
})