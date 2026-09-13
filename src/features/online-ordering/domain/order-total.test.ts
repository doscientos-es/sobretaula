import { describe, expect, it } from 'vitest'

import { calculateOnlineOrderTotal, validateOnlineOrderLines } from './order-total'
describe('online order totals', () => {
  it('calculates from validated line values', () =>
    expect(
      calculateOnlineOrderTotal([
        {
          menuItemId: '00000000-0000-0000-0000-000000000001',
          name: 'Bocadillo',
          quantity: 2,
          unitPriceCents: 850,
        },
        {
          menuItemId: '00000000-0000-0000-0000-000000000002',
          name: 'Agua',
          quantity: 1,
          unitPriceCents: 200,
        },
      ]),
    ).toBe(1900))
  it('rejects invalid lines', () =>
    expect(
      validateOnlineOrderLines([
        {
          menuItemId: '00000000-0000-0000-0000-000000000001',
          name: '',
          quantity: 1,
          unitPriceCents: 100,
        },
      ]),
    ).toBe('invalid_order_line'))
  it('requires a catalog item reference', () =>
    expect(
      validateOnlineOrderLines([
        { menuItemId: '', name: 'Agua', quantity: 1, unitPriceCents: 100 },
      ]),
    ).toBe('invalid_order_line'))
  it('rejects empty carts', () => expect(validateOnlineOrderLines([])).toBe('empty_order'))
})
