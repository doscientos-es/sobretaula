import { describe, expect, it } from 'vitest'

import {
  buildMenuSections,
  formatVatRate,
  localizedText,
  type MenuCategory,
  type MenuItem,
} from './menu'

const categories: MenuCategory[] = [
  { id: 'cat-2', isActive: true, nameI18n: { es: 'Postres' }, position: 2 },
  { id: 'cat-1', isActive: true, nameI18n: { es: 'Arroces' }, position: 1 },
  { id: 'cat-0', isActive: false, nameI18n: { es: 'Carta antigua' }, position: 0 },
]

function item(id: string, categoryId: string, name: string): MenuItem {
  return {
    categoryId,
    descriptionI18n: {},
    id,
    isActive: true,
    nameI18n: { es: name },
    priceCents: 1450,
    sku: null,
    vatRateBps: 1000,
  }
}

const items: MenuItem[] = [
  item('item-2', 'cat-1', 'Paella'),
  item('item-1', 'cat-1', 'Arroz negro'),
  item('item-3', 'cat-2', 'Flan'),
  item('item-4', 'cat-0', 'Plato retirado'),
]

describe('localizedText', () => {
  it('prefers the requested locale', () => {
    expect(localizedText({ ca: 'Arròs negre', es: 'Arroz negro' }, 'ca')).toBe('Arròs negre')
  })

  it('falls back to the default locale and then to any stored text', () => {
    expect(localizedText({ ca: 'Arròs negre', es: 'Arroz negro' }, 'es')).toBe('Arroz negro')
    expect(localizedText({ ca: 'Arròs negre' }, 'es')).toBe('Arròs negre')
    expect(localizedText({}, 'es')).toBe('')
  })
})

describe('buildMenuSections', () => {
  it('orders active categories by position and hides inactive ones', () => {
    const sections = buildMenuSections({ categories, items, locale: 'es' })

    expect(sections.map((section) => section.category.id)).toEqual(['cat-1', 'cat-2'])
  })

  it('orders items by their localized name inside each section', () => {
    const sections = buildMenuSections({ categories, items, locale: 'es' })

    expect(sections[0]?.items.map((entry) => entry.id)).toEqual(['item-1', 'item-2'])
    expect(sections[1]?.items.map((entry) => entry.id)).toEqual(['item-3'])
  })

  it('drops items whose category is inactive', () => {
    const sections = buildMenuSections({ categories, items, locale: 'es' })
    const allItems = sections.flatMap((section) => section.items)

    expect(allItems.some((entry) => entry.id === 'item-4')).toBe(false)
  })
})

describe('formatVatRate', () => {
  it('formats basis points as a localized percentage', () => {
    expect(formatVatRate(1000, 'es')).toBe('10 %')
    expect(formatVatRate(550, 'es')).toBe('5,5 %')
    expect(formatVatRate(0, 'es')).toBe('0 %')
  })
})
