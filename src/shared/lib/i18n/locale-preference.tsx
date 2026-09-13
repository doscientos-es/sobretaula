import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
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
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored ? parseLocale(stored) : null
  } catch {
    return null
  }
}

function browserLocale(): Locale {
  return typeof navigator === 'undefined' ? DEFAULT_LOCALE : parseLocale(navigator.language)
}

export function resolveLocalePreference({
  browserDefault,
  browserLanguage,
  defaultLocale,
  storedLocale,
}: {
  browserDefault: boolean
  browserLanguage?: string | null
  defaultLocale: Locale
  storedLocale?: string | null
}): Locale {
  if (storedLocale) return parseLocale(storedLocale)
  return browserDefault ? parseLocale(browserLanguage) : defaultLocale
}

const LOCALE_CHANGE_EVENT = 'sobretaula:locale-change'

function subscribeToLocale(onChange: () => void, storageKey: string | null) {
  if (typeof window === 'undefined') return () => undefined

  const handleStorage = (event: StorageEvent) => {
    if (!storageKey || event.key === storageKey || event.key === null) onChange()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener(LOCALE_CHANGE_EVENT, onChange)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(LOCALE_CHANGE_EVENT, onChange)
  }
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
  const inMemoryLocale = useRef<Locale | null>(null)
  const subscribe = useCallback(
    (onChange: () => void) => subscribeToLocale(onChange, storageKey),
    [storageKey],
  )
  const getSnapshot = useCallback(
    () =>
      inMemoryLocale.current ??
      resolveLocalePreference({
        browserDefault,
        browserLanguage: browserLocale(),
        defaultLocale,
        storedLocale: readStoredLocale(storageKey),
      }),
    [browserDefault, defaultLocale, storageKey],
  )
  const getServerSnapshot = useCallback(() => defaultLocale, [defaultLocale])
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (typeof window !== 'undefined') {
        let persisted = false
        try {
          if (storageKey) {
            window.localStorage.setItem(storageKey, nextLocale)
            persisted = true
          }
        } catch {
          // Fall back to the in-memory preference when storage is unavailable.
        }
        if (!persisted) inMemoryLocale.current = nextLocale
        window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT))
      }
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
