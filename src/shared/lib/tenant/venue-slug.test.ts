import { describe, expect, it } from 'vitest'

  it('returns null for absent or invalid values', () => {
    expect(parseVenueSlug(undefined)).toBeNull()
    expect(parseVenueSlug('')).toBeNull()
    expect(parseVenueSlug('nuevo')).toBeNull()
  })
})

describe('venueSlugCandidate', () => {
  it('strips accents and collapses separators', () => {
    expect(venueSlugCandidate('El Racó · Gràcia')).toBe('el-raco-gracia')
  })

  it('trims the result to the accepted length', () => {
    expect(venueSlugCandidate('a'.repeat(80))).toHaveLength(50)
  })
})

describe('isValidVenueSlug', () => {
  it('accepts lowercase kebab slugs', () => {
    expect(isValidVenueSlug('gracia')).toBe(true)
    expect(isValidVenueSlug('sant-antoni-2')).toBe(true)
  })

  it('rejects malformed slugs', () => {
    expect(isValidVenueSlug('a')).toBe(false)
    expect(isValidVenueSlug('-leading')).toBe(false)
    expect(isValidVenueSlug('trailing-')).toBe(false)
    expect(isValidVenueSlug('double--dash')).toBe(false)
    expect(isValidVenueSlug('Con Mayúsculas')).toBe(false)
  })

  it('rejects slugs reserved by the venue routes', () => {
    expect(isValidVenueSlug('nuevo')).toBe(false)
  })

  it('does not inherit the tenant reserved list', () => {
    expect(isValidVenueSlug('admin')).toBe(true)
  })
})

describe('parseVenueSlug', () => {
  it('normalises casing and padding', () => {
    expect(parseVenueSlug('  Sant-Antoni ')).toBe('sant-antoni')
  })

  it('returns null for absent or invalid values', () => {
    expect(parseVenueSlug(undefined)).toBeNull()
    expect(parseVenueSlug('')).toBeNull()
    expect(parseVenueSlug('nuevo')).toBeNull()
  })
})
