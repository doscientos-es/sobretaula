import { describe, expect, it } from 'vitest'

import {
  createMenuCategoryInput,
  createMenuItemInput,
  requireMenuEditor,
  updateMenuItemInput,
} from './menu-schema'

const tenantId = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const categoryId = 'a47ac10b-58cc-4372-a567-0e02b2c3d479'
const itemId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'

describe('menu schemas', () => {
  it('accepts a category named only in the default locale', () => {
    const parsed = createMenuCategoryInput.parse({ nameEs: 'Arroces', tenantId })

    expect(parsed.nameEs).toBe('Arroces')
    expect(parsed.nameCa).toBeUndefined()
  })

  it('rejects items without a Spanish name or with out-of-range money fields', () => {
    expect(() =>
      createMenuItemInput.parse({
        categoryId,
        nameEs: '',
        priceCents: 100,
        tenantId,
        vatRateBps: 1000,
      }),
    ).toThrow()
    expect(() =>
      createMenuItemInput.parse({
        categoryId,
        nameEs: 'Paella',
        priceCents: -1,
        tenantId,
        vatRateBps: 1000,
      }),
    ).toThrow()
    expect(() =>
      createMenuItemInput.parse({
        categoryId,
        nameEs: 'Paella',
        priceCents: 100,
        tenantId,
        vatRateBps: 10_001,
      }),
    ).toThrow()
  })

  it('rejects item updates without any change', () => {
    expect(() => updateMenuItemInput.parse({ itemId, tenantId })).toThrow()
    expect(() => updateMenuItemInput.parse({ isActive: false, itemId, tenantId })).not.toThrow()
  })
})

describe('requireMenuEditor', () => {
  it('allows direction roles only', () => {
    expect(() => requireMenuEditor('owner')).not.toThrow()
    expect(() => requireMenuEditor('manager')).not.toThrow()
    expect(() => requireMenuEditor('host')).toThrow()
    expect(() => requireMenuEditor('waiter')).toThrow()
    expect(() => requireMenuEditor('accountant')).toThrow()
  })
})
