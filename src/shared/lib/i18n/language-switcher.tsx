import type { ChangeEvent } from 'react'

import { SUPPORTED_LOCALES } from './locale'
import { useLocalePreference } from './locale-preference'
import { createTranslator } from './messages'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocalePreference()
  const t = createTranslator(locale)

  function changeLocale(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value
    if (SUPPORTED_LOCALES.includes(nextLocale as (typeof SUPPORTED_LOCALES)[number])) {
      setLocale(nextLocale as (typeof SUPPORTED_LOCALES)[number])
    }
  }

  return (
    <label className={`inline-flex items-center ${className}`}>
      <span className="sr-only">{t('common.language')}</span>
      <select
        aria-label={t('common.language')}
        className="border-border/70 bg-background min-h-8 rounded-md border px-2 text-xs font-medium"
        onChange={changeLocale}
        value={locale}
      >
        <option value="es">{t('common.languageSpanish')}</option>
        <option value="ca">{t('common.languageCatalan')}</option>
      </select>
    </label>
  )
}
