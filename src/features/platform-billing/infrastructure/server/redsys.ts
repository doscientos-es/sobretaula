import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export type RedsysSignatureVersion = 'HMAC_SHA256_V1' | 'HMAC_SHA512_V2'

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
  merchantCode: string
  terminal: string
  currency: string
  amountCents: number
  identifier?: string | undefined
}

export interface RedsysPaymentForm {
  url: string
  signatureVersion: 'HMAC_SHA512_V2'
  merchantParameters: string
  signature: string
}

export interface RedsysRestResponse {
  Ds_Response?: string | number
  [key: string]: unknown
}

function base64(value: Buffer | string): string {
  return (Buffer.isBuffer(value) ? value : Buffer.from(value)).toString('base64')
}

function base64Url(value: Buffer | string): string {
  return (Buffer.isBuffer(value) ? value : Buffer.from(value)).toString('base64url')
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

/** Derives the operation key required by Redsys HMAC_SHA512_V2. */
function deriveSha512OrderKey(order: string, secretKey: string): string {
  const merchantKey = secretKey.slice(0, 16).padEnd(16, '0')
  const cipher = createCipheriv(
    'aes-128-cbc',
    Buffer.from(merchantKey, 'utf8'),
    Buffer.alloc(16, 0),
  )
  const encryptedOrder = Buffer.concat([cipher.update(order, 'utf8'), cipher.final()])
  return base64(encryptedOrder)
}

function normalizedSignature(signature: string): Buffer {
  const standard = signature.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(standard + '='.repeat((4 - (standard.length % 4)) % 4), 'base64')
}

function readRequired(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

/** Encrypts a Redsys recurring reference before it is stored in Supabase. */
export function encryptRedsysReference(reference: string, encryptionKey: string): Buffer {
  if (!reference.trim() || !encryptionKey.trim()) throw new Error('invalid_redsys_reference')
  const key = createHash('sha256').update(encryptionKey, 'utf8').digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(reference, 'utf8'), cipher.final()])
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext])
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

function encodeParameters(parameters: Record<string, string>): string {
  return base64Url(JSON.stringify(parameters))
}

function signParameters({
  merchantParameters,
  merchantOrder,
  secretKey,
  signatureVersion,
}: {
  merchantParameters: string
  merchantOrder: string
  secretKey: string
  signatureVersion: RedsysSignatureVersion
}): string {
  if (signatureVersion === 'HMAC_SHA256_V1') {
    return base64(
      createHmac('sha256', deriveOrderKey(merchantOrder, secretKey))
        .update(merchantParameters)
        .digest(),
    )
  }
  return base64Url(
    createHmac('sha512', deriveSha512OrderKey(merchantOrder, secretKey))
      .update(merchantParameters)
      .digest(),
  )
}

/** Builds the hosted Redsys form used for the first subscription authorization. */
export function createRedsysPaymentForm({
  amountCents,
  merchantOrder,
  merchantUrl,
  successUrl,
  cancelUrl,
  config = readRedsysConfig(),
}: {
  amountCents: number
  merchantOrder: string
  merchantUrl: string
  successUrl: string
  cancelUrl: string
  config?: RedsysConfig
}): RedsysPaymentForm {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('invalid_redsys_amount')
  if (!/^[A-Za-z0-9]{4,12}$/.test(merchantOrder)) throw new Error('invalid_redsys_order')
  const merchantParameters = encodeParameters({
    Ds_Merchant_Amount: String(amountCents),
    Ds_Merchant_Currency: config.currency,
    Ds_Merchant_MerchantCode: config.merchantCode,
    Ds_Merchant_MerchantURL: merchantUrl,
    Ds_Merchant_Order: merchantOrder,
    Ds_Merchant_Terminal: config.terminal,
    Ds_Merchant_UrlOK: successUrl,
    Ds_Merchant_UrlKO: cancelUrl,
    Ds_Merchant_TransactionType: '0',
    Ds_Merchant_Identifier: 'REQUIRED',
    Ds_Merchant_COF_INI: 'S',
    Ds_Merchant_COF_TYPE: 'R',
  })
  const signatureVersion = 'HMAC_SHA512_V2'
  const signature = signParameters({
    merchantParameters,
    merchantOrder,
    secretKey: config.secretKey,
    signatureVersion,
  })
  return {
    url:
      config.environment === 'prod'
        ? 'https://sis.redsys.es/sis/realizarPago'
        : 'https://sis-t.redsys.es:25443/sis/realizarPago',
    signatureVersion,
    merchantParameters,
    signature,
  }
}

/** Executes a subsequent MIT/COF charge using a Redsys-managed reference. */
export async function chargeRedsysReference({
  amountCents,
  merchantOrder,
  identifier,
  config = readRedsysConfig(),
}: {
  amountCents: number
  merchantOrder: string
  identifier: string
  config?: RedsysConfig
}): Promise<RedsysRestResponse> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('invalid_redsys_amount')
  const parameters = encodeParameters({
    DS_MERCHANT_ORDER: merchantOrder,
    DS_MERCHANT_MERCHANTCODE: config.merchantCode,
    DS_MERCHANT_TERMINAL: config.terminal,
    DS_MERCHANT_CURRENCY: config.currency,
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_AMOUNT: String(amountCents),
    DS_MERCHANT_IDENTIFIER: identifier,
    DS_MERCHANT_COF_TYPE: 'R',
  })
  const signatureVersion = 'HMAC_SHA512_V2'
  const signature = signParameters({
    merchantParameters: parameters,
    merchantOrder,
    secretKey: config.secretKey,
    signatureVersion,
  })
  const endpoint =
    config.environment === 'prod'
      ? 'https://sis.redsys.es/sis/rest/trataPeticionREST'
      : 'https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      Ds_SignatureVersion: signatureVersion,
      Ds_MerchantParameters: parameters,
      Ds_Signature: signature,
    }),
    signal: AbortSignal.timeout(50_000),
  })
  if (!response.ok) throw new Error(`redsys_rest_http_${response.status}`)
  const body = (await response.json()) as { Ds_MerchantParameters?: string }
  if (!body.Ds_MerchantParameters) throw new Error('redsys_rest_response_missing_parameters')
  return JSON.parse(
    Buffer.from(body.Ds_MerchantParameters, 'base64').toString('utf8'),
  ) as RedsysRestResponse
}

/** Validates a Redsys notification without exposing the shared terminal secret. */
export function verifyRedsysSignature({
  merchantParameters,
  secretKey,
  signature,
  signatureVersion = 'HMAC_SHA512_V2',
}: {
  merchantParameters: string
  secretKey: string
  signature: string
  signatureVersion?: RedsysSignatureVersion
}): boolean {
  try {
    const decoded = JSON.parse(
      Buffer.from(merchantParameters, 'base64').toString('utf8'),
    ) as Record<string, unknown>
    const order =
      decoded.Ds_Order ?? decoded.Ds_Merchant_Order ?? decoded.DS_ORDER ?? decoded.DS_MERCHANT_ORDER
    if (typeof order !== 'string' || !/^[A-Za-z0-9]{4,12}$/.test(order)) return false
    const expected = Buffer.from(
      signParameters({ merchantParameters, merchantOrder: order, secretKey, signatureVersion }),
      signatureVersion === 'HMAC_SHA512_V2' ? 'base64url' : 'base64',
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
  const merchantOrder =
    decoded.Ds_Order ?? decoded.Ds_Merchant_Order ?? decoded.DS_ORDER ?? decoded.DS_MERCHANT_ORDER
  const responseCode = decoded.Ds_Response ?? decoded.DS_RESPONSE
  const merchantCode = decoded.Ds_MerchantCode ?? decoded.DS_MERCHANT_MERCHANTCODE
  const terminal = decoded.Ds_Terminal ?? decoded.DS_MERCHANT_TERMINAL
  const currency = decoded.Ds_Currency ?? decoded.DS_MERCHANT_CURRENCY
  const amount = decoded.Ds_Amount ?? decoded.DS_MERCHANT_AMOUNT
  const identifier = decoded.Ds_Merchant_Identifier ?? decoded.DS_MERCHANT_IDENTIFIER
  if (typeof merchantOrder !== 'string' || !/^[A-Za-z0-9]{4,12}$/.test(merchantOrder))
    throw new Error('invalid_redsys_order')
  if (typeof responseCode !== 'string' && typeof responseCode !== 'number')
    throw new Error('invalid_redsys_response')
  if (
    typeof merchantCode !== 'string' ||
    typeof terminal !== 'string' ||
    typeof currency !== 'string'
  )
    throw new Error('invalid_redsys_context')
  const amountCents = Number(amount)
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('invalid_redsys_amount')
  return {
    merchantOrder,
    responseCode: String(responseCode),
    merchantCode,
    terminal,
    currency,
    amountCents,
    identifier: typeof identifier === 'string' && identifier.trim() ? identifier.trim() : undefined,
  }
}

export function isRedsysSuccess(responseCode: string): boolean {
  const code = Number(responseCode)
  return Number.isInteger(code) && code >= 0 && code <= 99
}

/** Stable event id that deduplicates retries without retaining payment payloads. */
export function redsysPayloadSha256(merchantParameters: string): string {
  return createHash('sha256').update(merchantParameters).digest('hex')
}
