import { createCipheriv, createHash, createHmac, timingSafeEqual } from 'node:crypto'

export interface RedsysConfig {
  currency: string
  environment: 'prod' | 'test'
  merchantCode: string
  secretKey: string
  terminal: string
}

export interface RedsysNotification {
  merchantOrder: string
  responseCode: string
}

function base64Url(value: Buffer | string): string {
  return (Buffer.isBuffer(value) ? value : Buffer.from(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function deriveOrderKey(order: string, secretKey: string): Buffer {
  const key = Buffer.from(secretKey, 'base64')
  const cipher = createCipheriv('des-ede3-cbc', key, Buffer.alloc(8, 0))
  cipher.setAutoPadding(false)
  const source = Buffer.from(order, 'utf8')
  const padding = source.length % 8
  const padded = padding === 0 ? source : Buffer.concat([source, Buffer.alloc(8 - padding, 0)])
  return Buffer.concat([cipher.update(padded), cipher.final()])
}

function normalizedSignature(signature: string): Buffer {
  return Buffer.from(signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''))
}

function readRequired(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

/** Reads only the payment terminal dedicated to SobreTaula from server secrets. */
export function readRedsysConfig(): RedsysConfig {
  const environment = readRequired('REDSYS_ENVIRONMENT')
  if (environment !== 'test' && environment !== 'prod')
    throw new Error('invalid_redsys_environment')
  return {
    currency: process.env.REDSYS_CURRENCY?.trim() || '978',
    environment,
    merchantCode: readRequired('REDSYS_MERCHANT_CODE'),
    secretKey: readRequired('REDSYS_SECRET_KEY'),
    terminal: readRequired('REDSYS_TERMINAL'),
  }
}

/** Validates HMAC_SHA256_V1 without exposing the shared terminal secret. */
export function verifyRedsysSignature({
  merchantParameters,
  secretKey,
  signature,
}: {
  merchantParameters: string
  secretKey: string
  signature: string
}): boolean {
  try {
    const decoded = JSON.parse(
      Buffer.from(merchantParameters, 'base64').toString('utf8'),
    ) as Record<string, unknown>
    const order = decoded.Ds_Order ?? decoded.Ds_Merchant_Order
    if (typeof order !== 'string' || !/^[A-Za-z0-9]{4,12}$/.test(order)) return false
    const expected = Buffer.from(
      base64Url(
        createHmac('sha256', deriveOrderKey(order, secretKey)).update(merchantParameters).digest(),
      ),
    )
    const received = normalizedSignature(signature)
    return expected.length === received.length && timingSafeEqual(expected, received)
  } catch {
    return false
  }
}

/** Parses only the fields required by platform billing after signature validation. */
export function parseRedsysNotification(merchantParameters: string): RedsysNotification {
  const decoded = JSON.parse(Buffer.from(merchantParameters, 'base64').toString('utf8')) as Record<
    string,
    unknown
  >
  const merchantOrder = decoded.Ds_Order ?? decoded.Ds_Merchant_Order
  const responseCode = decoded.Ds_Response
  if (typeof merchantOrder !== 'string' || !/^[A-Za-z0-9]{4,12}$/.test(merchantOrder))
    throw new Error('invalid_redsys_order')
  if (typeof responseCode !== 'string' && typeof responseCode !== 'number')
    throw new Error('invalid_redsys_response')
  return { merchantOrder, responseCode: String(responseCode) }
}

export function isRedsysSuccess(responseCode: string): boolean {
  const code = Number(responseCode)
  return Number.isInteger(code) && code >= 0 && code <= 99
}

/** Stable event id that deduplicates retries without retaining payment payloads. */
export function redsysPayloadSha256(merchantParameters: string): string {
  return createHash('sha256').update(merchantParameters).digest('hex')
}
