import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, isSupportedLocale, parseLocale } from './locale'

describe('parseLocale', () => {
  it('falls back to the platform default when the value is missing', () => {
    expect(parseLocale(undefined)).toBe(DEFAULT_LOCALE)
    expect(parseLocale(null)).toBe('es')
    expect(parseLocale('')).toBe('es')
  })

  it('accepts regional and cased variants of a supported language', () => {
    expect(parseLocale('CA')).toBe('ca')
    expect(parseLocale('ca-ES')).toBe('ca')
    expect(parseLocale('es_ES')).toBe('es')
  })

  it('falls back when the language is not supported yet', () => {
    expect(parseLocale('fr')).toBe('es')
    expect(parseLocale('en-GB')).toBe('es')
  })
})

describe('isSupportedLocale', () => {
  it('recognises only the shipped languages', () => {
    expect(isSupportedLocale('es')).toBe(true)
    expect(isSupportedLocale('ca')).toBe(true)
    expect(isSupportedLocale('en')).toBe(false)
  })
})
