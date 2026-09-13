import { describe, expect, it } from 'vitest'

import { canAdvanceOnlineOrder } from './order-status'
describe('online order status', () => {
  it('follows the kitchen flow', () =>
    expect(canAdvanceOnlineOrder('accepted', 'preparing')).toBe(true))
  it('does not reopen completed orders', () =>
    expect(canAdvanceOnlineOrder('completed', 'preparing')).toBe(false))
})
