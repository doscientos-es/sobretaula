import { describe, expect, it } from 'vitest'

import { canRedeemGiftCard, normalizeGiftCardCode } from './gift-card'
describe('gift cards', () => {
  it('normalizes codes for reliable lookup', () =>
    expect(normalizeGiftCardCode(' st 100-ab ')).toBe('ST100-AB'))
  it('rejects redemptions above balance', () => expect(canRedeemGiftCard(1000, 1001)).toBe(false))
})
