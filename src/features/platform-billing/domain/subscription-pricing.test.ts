import { describe, expect, it } from 'vitest'

import {
  extraVenueNetCents,
  monthlyNetCentsForCycle,
  priceWithVat,
  subscriptionMonthlyNetCents,
  INTRODUCTORY_MONTHLY_NET_CENTS,
} from './subscription-pricing'

describe('subscription pricing', () => {
  it('charges 99 EUR net for the first twelve monthly cycles', () => {
    expect(
      monthlyNetCentsForCycle({
        cycle: 12,
        hasFoundersBenefit: false,
        standardMonthlyNetCents: 30_000,
      }),
    ).toBe(INTRODUCTORY_MONTHLY_NET_CENTS)
  })

  it('moves non-Founders to the 300 EUR net plan price after the first year', () => {
    expect(
      monthlyNetCentsForCycle({
        cycle: 13,
        hasFoundersBenefit: false,
        standardMonthlyNetCents: 30_000,
      }),
    ).toBe(30_000)
  })

  it('keeps Founders at half of the current plan price after the first year', () => {
    expect(
      monthlyNetCentsForCycle({
        cycle: 13,
        hasFoundersBenefit: true,
        standardMonthlyNetCents: 36_000,
      }),
    ).toBe(18_000)
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

  it('charges 100 EUR net for every additional venue', () => {
    expect(extraVenueNetCents({ venueCount: 3 })).toBe(20_000)
  })

  it('rejects a company without venues', () => {
    expect(() => extraVenueNetCents({ venueCount: 0 })).toThrow('invalid_venue_count')
  })

  it('adds the venue surcharge on top of the introductory plan price', () => {
    expect(
      subscriptionMonthlyNetCents({
        cycle: 1,
        hasFoundersBenefit: false,
        standardMonthlyNetCents: 30_000,
        venueCount: 2,
      }),
    ).toBe(INTRODUCTORY_MONTHLY_NET_CENTS + 10_000)
  })

  it('keeps additional venues at full price for Founders', () => {
    expect(
      subscriptionMonthlyNetCents({
        cycle: 13,
        hasFoundersBenefit: true,
        standardMonthlyNetCents: 30_000,
        venueCount: 2,
      }),
    ).toBe(25_000)
  })
})
