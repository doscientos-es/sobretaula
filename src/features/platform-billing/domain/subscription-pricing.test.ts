import { describe, expect, it } from 'vitest'

import {
  extraVenueNetCents,
  monthlyNetCentsForCycle,
  priceWithVat,
  subscriptionMonthlyNetCents,
  FOUNDERS_MONTHLY_NET_CENTS,
  STANDARD_MONTHLY_NET_CENTS,
} from './subscription-pricing'

describe('subscription pricing', () => {
  it('charges 149 EUR net per month for the standard plan', () => {
    expect(
      monthlyNetCentsForCycle({
        cycle: 1,
        hasFoundersBenefit: false,
        standardMonthlyNetCents: STANDARD_MONTHLY_NET_CENTS,
      }),
    ).toBe(STANDARD_MONTHLY_NET_CENTS)
  })

  it('does not raise the standard price after a year', () => {
    expect(
      monthlyNetCentsForCycle({
        cycle: 13,
        hasFoundersBenefit: false,
        standardMonthlyNetCents: STANDARD_MONTHLY_NET_CENTS,
      }),
    ).toBe(STANDARD_MONTHLY_NET_CENTS)
  })

  it('keeps Founders at 99 EUR net without a later increase', () => {
    expect(
      monthlyNetCentsForCycle({
        cycle: 13,
        hasFoundersBenefit: true,
        standardMonthlyNetCents: STANDARD_MONTHLY_NET_CENTS,
      }),
    ).toBe(FOUNDERS_MONTHLY_NET_CENTS)
  })

  it('adds Spanish VAT after calculating the net subscription amount', () => {
    expect(priceWithVat({ netCents: 9_900 })).toEqual({
      netCents: 9_900,
      totalCents: 11_979,
      vatCents: 2_079,
    })
  })

  it('includes the first venue in the plan price', () => {
    expect(extraVenueNetCents({ venueCount: 1 })).toBe(0)
  })

  it('charges 75 EUR net for every additional venue', () => {
    expect(extraVenueNetCents({ venueCount: 3 })).toBe(15_000)
  })

  it('rejects a company without venues', () => {
    expect(() => extraVenueNetCents({ venueCount: 0 })).toThrow('invalid_venue_count')
  })

  it('adds the venue surcharge on top of the standard plan price', () => {
    expect(
      subscriptionMonthlyNetCents({
        cycle: 1,
        hasFoundersBenefit: false,
        standardMonthlyNetCents: STANDARD_MONTHLY_NET_CENTS,
        venueCount: 2,
      }),
    ).toBe(STANDARD_MONTHLY_NET_CENTS + 7_500)
  })

  it('keeps additional venues at full price for Founders', () => {
    expect(
      subscriptionMonthlyNetCents({
        cycle: 13,
        hasFoundersBenefit: true,
        standardMonthlyNetCents: STANDARD_MONTHLY_NET_CENTS,
        venueCount: 2,
      }),
    ).toBe(FOUNDERS_MONTHLY_NET_CENTS + 7_500)
  })
})
