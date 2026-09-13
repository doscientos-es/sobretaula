import { describe, expect, it } from 'vitest'

import { buildCashHistoryCsv } from './cash-export'

describe('cash history export', () => {
  it('builds stable method columns and escapes CSV values', () => {
    const csv = buildCashHistoryCsv([
      {
        closedAt: '2026-09-13T22:00:00.000Z',
        countedCashCents: 1200,
        openingFloatCents: 5000,
        openedAt: '2026-09-13T10:00:00.000Z',
        salesByMethod: { card: 3400, cash: 1800 },
        status: 'closed,ok',
      },
    ])
    expect(csv).toContain('ventas_card_cents,ventas_cash_cents')
    expect(csv).toContain('"closed,ok",3400,1800')
  })

  it('fills methods missing from a closure with zero', () => {
    const csv = buildCashHistoryCsv([
      {
        closedAt: null,
        countedCashCents: null,
        openingFloatCents: 0,
        openedAt: null,
        salesByMethod: { cash: 100 },
        status: 'closed',
      },
      {
        closedAt: null,
        countedCashCents: 0,
        openingFloatCents: 0,
        openedAt: null,
        salesByMethod: { card: 200 },
        status: 'closed',
      },
    ])
    expect(csv.split('\n')[2]).toContain(',0,200')
  })
})
