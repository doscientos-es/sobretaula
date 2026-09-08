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
