import { describe, expect, it } from 'vitest'
import { aggregateSales, summarizeProducts } from './sales-report'
describe('sales reports', () => { it('aggregates methods and VAT', () => { expect(aggregateSales([{ method: 'cash', amountCents: 1210 }, { method: 'card', amountCents: 2420 }], [{ name: 'Plato', quantity: 1, amountCents: 1210, vatRateBps: 1000 }])).toMatchObject({ grossCents: 3630, byMethod: { cash: 1210, card: 2420 }, vatCents: 110, ticketAverageCents: 3630 }) }) })
it('groups products by name and ranks revenue', () => { expect(summarizeProducts([{ name: 'Pan', quantity: 1, amountCents: 100, vatRateBps: 1000 }, { name: 'Pan', quantity: 2, amountCents: 200, vatRateBps: 1000 }])).toEqual([{ name: 'Pan', quantity: 3, amountCents: 300 }]) })
