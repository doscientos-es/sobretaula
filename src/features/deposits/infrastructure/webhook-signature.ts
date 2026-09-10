import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyDepositWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  const actual = signature.trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(actual)) return false
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))
}
