import { isValidNifFormat, normalizeNif, type VerifactuEnv } from './invoice'

/** Restaurant fiscal settings are always configured for the production environment. */
export const DEFAULT_VERIFACTU_ENV: VerifactuEnv = 'prod'

/** Fiscal identity of the restaurant as emitter (one row per tenant). */
export interface FiscalSettings {
  addressLine: string
  city: string
  countryCode: string
  environment: VerifactuEnv
  issuerNif: string
  legalName: string
  postalCode: string
}

/** Series and counter: correlation is reserved transactionally in Postgres. */
export interface InvoiceSeries {
  code: string
  fiscalYear: number
  id: string
  nextNumber: number
}

/** Series code kept short because it becomes part of `full_number`. */
export const SERIES_CODE_PATTERN = /^[A-Z0-9-]{1,12}$/

export function normalizeSeriesCode(rawCode: string): string {
  return rawCode.trim().toUpperCase()
}

export function isValidSeriesCode(rawCode: string): boolean {
  return SERIES_CODE_PATTERN.test(normalizeSeriesCode(rawCode))
}

export interface FiscalSettingsInput {
  addressLine: string
  city: string
  countryCode: string
  issuerNif: string
  legalName: string
  postalCode: string
}

/**
 * Validates and normalizes the fiscal settings a tenant owner can edit. The
 * certificate is NOT part of this flow: it goes through the dedicated upload
 * endpoint and is stored encrypted (ADR-0005).
 */
export function validateFiscalSettings(input: FiscalSettingsInput): FiscalSettings {
  const issuerNif = normalizeNif(input.issuerNif)
  if (!isValidNifFormat(issuerNif)) throw new Error('fiscal_settings_invalid_nif')
  const legalName = input.legalName.trim()
  if (legalName.length === 0 || legalName.length > 120)
    throw new Error('fiscal_settings_invalid_legal_name')
  const addressLine = input.addressLine.trim()
  if (addressLine.length === 0 || addressLine.length > 200)
    throw new Error('fiscal_settings_invalid_address')
  const city = input.city.trim()
  if (city.length === 0 || city.length > 80) throw new Error('fiscal_settings_invalid_city')
  const postalCode = input.postalCode.trim()
  if (!/^\d{5}$/.test(postalCode)) throw new Error('fiscal_settings_invalid_postal_code')
  const countryCode = input.countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('fiscal_settings_invalid_country')

  return {
    addressLine,
    city,
    countryCode,
    environment: DEFAULT_VERIFACTU_ENV,
    issuerNif,
    legalName,
    postalCode,
  }
}
