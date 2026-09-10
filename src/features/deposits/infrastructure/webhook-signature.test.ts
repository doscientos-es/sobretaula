import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { verifyDepositWebhookSignature } from './webhook-signature'
describe('verifyDepositWebhookSignature', () => {
  it('accepts the exact HMAC and rejects tampering', () => {
    const body = '{"ok":true}'
    const signature = createHmac('sha256', 'secret').update(body).digest('hex')
    expect(verifyDepositWebhookSignature(body, signature, 'secret')).toBe(true)
    expect(verifyDepositWebhookSignature('{"ok":false}', signature, 'secret')).toBe(false)
  })
})
