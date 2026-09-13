import { describe, expect, it } from 'vitest'

import { canAcceptOnlineOrder } from './payment-state'
describe('online payment state', () => {
  it('accepts confirmed payment', () => expect(canAcceptOnlineOrder('paid')).toBe(true))
  it('rejects failed payment', () => expect(canAcceptOnlineOrder('failed')).toBe(false))
})
