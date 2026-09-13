import { describe, expect, it } from 'vitest'

import { calculateCampaignMetrics } from './campaign-metrics'
describe('campaign metrics', () => {
  it('calculates revenue and conversions', () =>
    expect(
      calculateCampaignMetrics([
        { status: 'sent', attributedRevenueCents: 2500 },
        { status: 'failed', attributedRevenueCents: 0 },
        { status: 'pending', attributedRevenueCents: 0 },
      ]),
    ).toEqual({ recipients: 3, sent: 2, conversions: 1, attributedRevenueCents: 2500 }))
})
