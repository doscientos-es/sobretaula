import { describe, expect, it } from 'vitest'

import {
  addOrderItemInput,
  recordPaymentInput,
  removeOrderItemInput,
  requireAccountEditor,
} from './account-schema'

const base = {
  sessionId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  tenantId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
  venueId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
}

describe('account schemas', () => {
  it('accepts adding a menu item with quantity and optional notes', () => {
    const parsed = addOrderItemInput.parse({
      ...base,
      menuItemId: 'c5b8a9d2-1234-4e5f-8a9b-0c1d2e3f4a5b',
      quantity: 2,
    })

    expect(parsed.quantity).toBe(2)
    expect(parsed.notes).toBeUndefined()
  })

  it('rejects quantities outside 1..99', () => {
    expect(() =>
      addOrderItemInput.parse({
        ...base,
        menuItemId: 'c5b8a9d2-1234-4e5f-8a9b-0c1d2e3f4a5b',
        quantity: 0,
      }),
    ).toThrow()
  })

  it('validates payments against the supported methods', () => {
    const parsed = recordPaymentInput.parse({ ...base, amountCents: 2550, method: 'card' })
    expect(parsed.tipCents).toBeUndefined()

    expect(() =>
      recordPaymentInput.parse({ ...base, amountCents: 2550, method: 'bizum' }),
    ).toThrow()
    expect(() => recordPaymentInput.parse({ ...base, amountCents: 0, method: 'cash' })).toThrow()
    expect(() =>
      recordPaymentInput.parse({ ...base, amountCents: 100, method: 'cash', tipCents: -1 }),
    ).toThrow()
  })

  it('requires the order item id when removing a line', () => {
    expect(() => removeOrderItemInput.parse(base)).toThrow()
    expect(() =>
      removeOrderItemInput.parse({
        ...base,
        orderItemId: 'd4c5b6a7-8e9f-4a0b-9c8d-7e6f5a4b3c2d',
      }),
    ).toThrow()
    expect(() =>
      removeOrderItemInput.parse({
        ...base,
        orderItemId: 'd4c5b6a7-8e9f-4a0b-9c8d-7e6f5a4b3c2d',
        reason: 'Plato duplicado',
      }),
    ).not.toThrow()
  })
})

describe('requireAccountEditor', () => {
  it('allows the room roles that charge tables', () => {
    expect(() => requireAccountEditor('owner')).not.toThrow()
    expect(() => requireAccountEditor('manager')).not.toThrow()
    expect(() => requireAccountEditor('waiter')).not.toThrow()
    expect(() => requireAccountEditor('host')).toThrow()
    expect(() => requireAccountEditor('accountant')).toThrow()
  })
})
