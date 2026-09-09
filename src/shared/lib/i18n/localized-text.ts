import { DEFAULT_LOCALE, type Locale } from './locale'

/** Catalog texts travel as jsonb `{ es, ca }`; each locale is optional in storage. */
export type LocalizedText = Record<string, string>

/** Requested locale first, default locale next, then any stored text. */
export function localizedText(text: LocalizedText, locale: Locale): string {
  const direct = text[locale]?.trim()
  if (direct) return direct
  const fallback = text[DEFAULT_LOCALE]?.trim()
  if (fallback) return fallback
  return Object.values(text).find((value) => value.trim().length > 0)?.trim() ?? ''
}
