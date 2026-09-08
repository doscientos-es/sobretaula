import { describe, expect, it } from 'vitest'

import { isValidTenantSlug, parseTenantSlug } from './tenant-slug'

describe('isValidTenantSlug', () => {
  it('accepts lowercase kebab slugs', () => {
    expect(isValidTenantSlug('can-pere')).toBe(true)
    expect(isValidTenantSlug('bar-42')).toBe(true)
  })

  it('rejects malformed slugs', () => {
    expect(isValidTenantSlug('a')).toBe(false)
    expect(isValidTenantSlug('-leading')).toBe(false)
    expect(isValidTenantSlug('trailing-')).toBe(false)
    expect(isValidTenantSlug('double--dash')).toBe(false)
    expect(isValidTenantSlug('Con Mayúsculas')).toBe(false)
  })

  it('rejects slugs reserved by the platform', () => {
    expect(isValidTenantSlug('admin')).toBe(false)
    expect(isValidTenantSlug('api')).toBe(false)
  })
})

describe('parseTenantSlug', () => {
  it('normalises casing and padding', () => {
    expect(parseTenantSlug('  Can-Pere ')).toBe('can-pere')
  })

  it('returns null for absent or invalid values', () => {
    expect(parseTenantSlug(undefined)).toBeNull()
    expect(parseTenantSlug('')).toBeNull()
    expect(parseTenantSlug('admin')).toBeNull()
  })
})
