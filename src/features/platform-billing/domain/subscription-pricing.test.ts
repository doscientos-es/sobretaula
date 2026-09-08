import { describe, expect, it } from 'vitest'

import {
  monthlyNetCentsForCycle,
  priceWithVat,
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
})
