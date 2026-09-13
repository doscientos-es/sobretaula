import { describe, expect, it } from 'vitest'

import { validatePaymentIntent } from './payment-adapter'
describe('online payment adapter contract', () => {
  it('accepts only an exact EUR intent', () => {
    const intent = {
      orderId: 'order-1',
      amountCents: 2500,
      currency: 'EUR' as const,
      checkoutUrl: 'https://pay.test/1',
      provider: 'sandbox',
    }
    expect(validatePaymentIntent(intent, 2500)).toBe(true)
    expect(validatePaymentIntent({ ...intent, amountCents: 2400 }, 2500)).toBe(false)
  })
})
