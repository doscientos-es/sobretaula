import { describe, expect, it } from 'vitest'

import {
  computeAccountTotals,
  lineGrossCents,
  lineNetCents,
  splitEvenly,
  type AccountLine,
  type AccountPayment,
} from './account'

function line(overrides: Partial<AccountLine>): AccountLine {
  return {
    id: 'line-1',
    name: 'Paella',
    notes: null,
    quantity: 1,
    unitPriceCents: 1000,
    vatRateBps: 1000,
    ...overrides,
  }
}

function payment(overrides: Partial<AccountPayment>): AccountPayment {
  return {
    amountCents: 1000,
    id: 'payment-1',
    method: 'cash',
    paidAt: '2026-09-09T20:00:00.000Z',
    tipCents: 0,
    ...overrides,
  }
}

describe('line totals', () => {
  it('multiplies quantity by the frozen unit price', () => {
    expect(lineGrossCents(line({ quantity: 3, unitPriceCents: 450 }))).toBe(1350)
  })

  it('includes frozen modifier supplements once per unit', () => {
    expect(
      lineGrossCents(
        line({
          modifiers: [{ id: 'modifier-1', name: 'Extra queso', priceDeltaCents: 150 }],
          quantity: 2,
          unitPriceCents: 1000,
        }),
      ),
    ).toBe(2300)
  })

  it('extracts the net from a VAT-included price', () => {
    expect(lineNetCents(line({ unitPriceCents: 1000, vatRateBps: 1000 }))).toBe(909)
    expect(lineNetCents(line({ unitPriceCents: 1000, vatRateBps: 2100 }))).toBe(826)
    expect(lineNetCents(line({ unitPriceCents: 1000, vatRateBps: 0 }))).toBe(1000)
  })

  it('rounds the net to the nearest cent', () => {
    // 333 céntimos al 10 % → 302,72… → 303
    expect(lineNetCents(line({ unitPriceCents: 333, vatRateBps: 1000 }))).toBe(303)
  })
})

describe('computeAccountTotals', () => {
  it('sums gross, net and VAT across lines and tracks the balance', () => {
    const totals = computeAccountTotals(
      [
        line({ id: 'a', quantity: 2, unitPriceCents: 1450, vatRateBps: 1000 }),
        line({ id: 'b', quantity: 1, unitPriceCents: 800, vatRateBps: 2100 }),
      ],
      [payment({ amountCents: 1000, tipCents: 200 })],
    )

    expect(totals.grossCents).toBe(3700)
    expect(totals.netCents).toBe(2636 + 661)
    expect(totals.vatCents).toBe(3700 - 3297)
    expect(totals.paidCents).toBe(1000)
    expect(totals.tipCents).toBe(200)
    expect(totals.balanceCents).toBe(2700)
  })

  it('never lets the tip pay the bill', () => {
    const totals = computeAccountTotals([line({})], [payment({ amountCents: 1000, tipCents: 500 })])

    expect(totals.balanceCents).toBe(0)
    expect(totals.tipCents).toBe(500)
  })

  it('subtracts an audited discount from the amount still due', () => {
    const totals = computeAccountTotals([line({})], [], 250)

    expect(totals.grossCents).toBe(750)
    expect(totals.balanceCents).toBe(750)
  })

  it('handles an empty account', () => {
    expect(computeAccountTotals([], [])).toEqual({
      balanceCents: 0,
      grossCents: 0,
      netCents: 0,
      paidCents: 0,
      tipCents: 0,
      vatCents: 0,
    })
  })

  it('excludes cancelled lines while keeping them available for the audit trail', () => {
    const totals = computeAccountTotals(
      [
        line({ id: 'served', unitPriceCents: 1200 }),
        line({ id: 'cancelled', status: 'cancelled', unitPriceCents: 800 }),
      ],
      [],
    )

    expect(totals.grossCents).toBe(1200)
    expect(totals.balanceCents).toBe(1200)
  })
})

describe('splitEvenly', () => {
  it('splits evenly when the division is exact', () => {
    expect(splitEvenly(900, 3)).toEqual([300, 300, 300])
  })

  it('distributes the remainder cent by cent from the first part', () => {
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333])
    expect(splitEvenly(101, 2)).toEqual([51, 50])
  })

  it('keeps the whole amount in a single part', () => {
    expect(splitEvenly(2550, 1)).toEqual([2550])
  })

  it('rejects zero or fractional parts', () => {
    expect(() => splitEvenly(1000, 0)).toThrow('invalid_split_parts')
    expect(() => splitEvenly(1000, 2.5)).toThrow('invalid_split_parts')
  })
})
