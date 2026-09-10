import { createCipheriv, createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  isRedsysSuccess,
  createRedsysPaymentForm,
  parseRedsysNotification,
  redsysPayloadSha256,
  verifyRedsysSignature,
} from './redsys'

const secretKey = Buffer.alloc(24, 7).toString('base64')
const params = Buffer.from(
  JSON.stringify({ Ds_Order: 'BILL202601', Ds_Response: '0000' }),
).toString('base64url')

function signatureFor(order: string, merchantParameters: string): string {
  const cipher = createCipheriv(
    'des-ede3-cbc',
    Buffer.from(secretKey, 'base64'),
    Buffer.alloc(8, 0),
  )
  cipher.setAutoPadding(false)
  const source = Buffer.from(order)
  const padding = source.length % 8
  const key = Buffer.concat([
    cipher.update(padding === 0 ? source : Buffer.concat([source, Buffer.alloc(8 - padding, 0)])),
    cipher.final(),
  ])
  return createHmac('sha256', key).update(merchantParameters).digest('base64url')
}

describe('Redsys notification helpers', () => {
  it('builds a hosted form with a verifiable signature', () => {
    const form = createRedsysPaymentForm({
      amountCents: 14900,
      merchantOrder: 'BILL202601',
      merchantUrl: 'https://example.test/api/webhooks/redsys',
      successUrl: 'https://example.test/ok',
      cancelUrl: 'https://example.test/ko',
      config: {
        currency: '978',
        environment: 'test',
        merchantCode: 'merchant',
        secretKey,
        terminal: '1',
      },
    })
    expect(form.url).toContain('sis-t.redsys.es')
    expect(
      verifyRedsysSignature({
        merchantParameters: form.merchantParameters,
        secretKey,
        signature: form.signature,
      }),
    ).toBe(true)
  })
  it('accepts an authentic HMAC_SHA256_V1 notification', () => {
    expect(
      verifyRedsysSignature({
        merchantParameters: params,
        secretKey,
        signature: signatureFor('BILL202601', params),
      }),
    ).toBe(true)
  })

  it('rejects a modified notification and extracts safe fields from valid payloads', () => {
    expect(
      verifyRedsysSignature({ merchantParameters: params, secretKey, signature: 'invalid' }),
    ).toBe(false)
    expect(parseRedsysNotification(params)).toEqual({
      merchantOrder: 'BILL202601',
      responseCode: '0000',
    })
    expect(isRedsysSuccess('0099')).toBe(true)
    expect(isRedsysSuccess('0101')).toBe(false)
    expect(redsysPayloadSha256(params)).toHaveLength(64)
  })
})
