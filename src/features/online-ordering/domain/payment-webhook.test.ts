import { describe, expect, it } from 'vitest'

import { isPaymentAmountValid, paymentWebhookStatus } from './payment-webhook'
describe('payment webhook', () => {
  it('maps success', () => expect(paymentWebhookStatus('0000')).toBe('paid'))
  it('maps failure', () => expect(paymentWebhookStatus('0199')).toBe('failed'))
  it('requires exact amount for successful payments', () => {
    expect(isPaymentAmountValid('paid', 2500, 2500)).toBe(true)
    expect(isPaymentAmountValid('authorized', 2500, 2400)).toBe(false)
    expect(isPaymentAmountValid('failed', 2500, 0)).toBe(true)
  })
})
