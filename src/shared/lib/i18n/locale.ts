export const SUPPORTED_LOCALES = ['es', 'ca'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Accepts anything (URL param, Accept-Language, tenant setting) and always
 * resolves to a supported locale. Adding a language is a change here only.
 */
export function parseLocale(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE

  const normalized = value.trim().toLowerCase().split(/[-_]/)[0] ?? ''
  return isSupportedLocale(normalized) ? normalized : DEFAULT_LOCALE
}
