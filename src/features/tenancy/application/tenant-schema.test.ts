import { describe, expect, it } from 'vitest'

import { tenantRowSchema, toTenant } from './tenant-schema'

const row = {
  default_locale: 'ca',
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Can Pere',
  slug: 'can-pere',
  status: 'active',
  timezone: 'Europe/Madrid',
}

describe('tenantRowSchema', () => {
  it('accepts a well formed row', () => {
    expect(tenantRowSchema.parse(row).slug).toBe('can-pere')
  })

  it('rejects an unsupported locale', () => {
    expect(() => tenantRowSchema.parse({ ...row, default_locale: 'fr' })).toThrow()
  })
})

describe('toTenant', () => {
  it('maps snake_case storage into the domain shape', () => {
    expect(toTenant(tenantRowSchema.parse(row))).toEqual({
      defaultLocale: 'ca',
      id: row.id,
      name: 'Can Pere',
      slug: 'can-pere',
      status: 'active',
      timezone: 'Europe/Madrid',
    })
  })
})
