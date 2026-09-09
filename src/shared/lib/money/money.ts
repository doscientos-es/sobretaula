import type { Locale } from '../i18n/locale'

/** Amounts always travel as integer minor units. Never as floats. */
export type MinorUnits = number

export function assertMinorUnits(value: number): MinorUnits {
  if (!Number.isSafeInteger(value))
    throw new Error('Los importes se expresan en unidades menores enteras.')
  return value
}

export function formatMoney(value: MinorUnits, locale: Locale, currency = 'EUR'): string {
  return new Intl.NumberFormat(locale, { currency, style: 'currency' }).format(
    assertMinorUnits(value) / 100,
  )
}


/** Accepts "12,50" or "12.50" and returns minor units. Null when it is not a price. */
export function parsePriceToCents(value: string): MinorUnits | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) && cents <= 1_000_000 ? cents : null
}