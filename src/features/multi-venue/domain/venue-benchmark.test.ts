import { describe, expect, it } from 'vitest'

import { benchmarkVenues } from './venue-benchmark'
describe('benchmarkVenues', () => {
  it('ranks venues by contribution and computes ratios', () =>
    expect(
      benchmarkVenues([
        {
          venueId: 'a',
          venueName: 'Centro',
          netSalesCents: 100000,
          contributionCents: 40000,
          wasteCents: 2500,
        },
        {
          venueId: 'b',
          venueName: 'Playa',
          netSalesCents: 200000,
          contributionCents: 30000,
          wasteCents: 1000,
        },
      ]),
    ).toMatchObject([
      { venueId: 'a', rank: 1, contributionPercent: 40, wastePercent: 2.5 },
      { venueId: 'b', rank: 2 },
    ]))
})
