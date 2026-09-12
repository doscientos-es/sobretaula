import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { DEFAULT_LOCALE, parseLocale, type Locale } from './locale'

export const AUTH_LOCALE_STORAGE_KEY = 'sobretaula.locale'
export const PUBLIC_LOCALE_STORAGE_KEY = 'sobretaula.public-locale'

type LocalePreference = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocalePreferenceContext = createContext<LocalePreference | null>(null)

function readStoredLocale(storageKey: string | null): Locale | null {
  if (!storageKey || typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(storageKey)
  return stored ? parseLocale(stored) : null
}

function browserLocale(): Locale {
  return typeof navigator === 'undefined' ? DEFAULT_LOCALE : parseLocale(navigator.language)
}

export function LocaleProvider({
  browserDefault = false,
  children,
  defaultLocale = DEFAULT_LOCALE,
  storageKey = AUTH_LOCALE_STORAGE_KEY,
}: {
  browserDefault?: boolean
  children: ReactNode
  defaultLocale?: Locale
  storageKey?: string | null
}) {
  const [locale, setLocaleState] = useState(defaultLocale)

  useEffect(() => {
    setLocaleState(
      readStoredLocale(storageKey) ?? (browserDefault ? browserLocale() : defaultLocale),
    )
  }, [browserDefault, defaultLocale, storageKey])

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      setLocaleState(nextLocale)
      if (storageKey) window.localStorage.setItem(storageKey, nextLocale)
    },
    [storageKey],
  )
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return (
    <LocalePreferenceContext.Provider value={value}>{children}</LocalePreferenceContext.Provider>
  )
}

export function useLocale(fallback: Locale = DEFAULT_LOCALE): Locale {
  return useContext(LocalePreferenceContext)?.locale ?? fallback
}

export function useLocalePreference(): LocalePreference {
  const preference = useContext(LocalePreferenceContext)
  if (!preference) {
    return { locale: DEFAULT_LOCALE, setLocale: () => undefined }
  }
  return preference
}
