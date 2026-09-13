import { type Locale } from '@/shared/lib/i18n/locale'
import { localizedText, type LocalizedText } from '@/shared/lib/i18n/localized-text'

export { localizedText, type LocalizedText }

export const KITCHEN_STATIONS = ['general', 'hot', 'cold', 'bar', 'dessert'] as const
export type KitchenStation = (typeof KITCHEN_STATIONS)[number]
export const MENU_CHANNELS = ['room', 'web', 'delivery', 'takeaway'] as const
export type MenuChannel = (typeof MENU_CHANNELS)[number]

export interface MenuModifierOption {
  id: string
  isActive: boolean
  nameI18n: LocalizedText
  priceDeltaCents: number
  allergens?: readonly string[]
  isVegan?: boolean
  ingredientId?: string | null
  replacesIngredientId?: string | null
  position: number
}

export interface MenuModifierGroup {
  id: string
  isActive: boolean
  nameI18n: LocalizedText
  options: MenuModifierOption[]
  selectionMax: number
  selectionMin: number
  position: number
}

export interface MenuCategory {
  id: string
  isActive: boolean
  nameI18n: LocalizedText
  position: number
}

export interface MenuItem {
  categoryId: string
  descriptionI18n: LocalizedText
  id: string
  isActive: boolean
  kitchenStation?: KitchenStation
  nameI18n: LocalizedText
  priceCents: number
  preparationMinutes?: number
  sku: string | null
  vatRateBps: number
  allergens?: readonly string[]
  isAvailable?: boolean
  isVegan?: boolean
  allergenReasons?: Readonly<Record<string, readonly string[]>>
  modifierGroups?: MenuModifierGroup[]
}

export interface MenuSection {
  category: MenuCategory
  items: MenuItem[]
}

export interface MenuSectionFilters {
  isActive?: boolean | undefined
  kitchenStation?: KitchenStation | undefined
  locale: Locale
  query: string
}

/** Active categories ordered by position and name, each with its items by name. */
export function buildMenuSections({
  categories,
  items,
  locale,
}: {
  categories: readonly MenuCategory[]
  items: readonly MenuItem[]
  locale: Locale
}): MenuSection[] {
  const activeCategories = categories
    .filter((category) => category.isActive)
    .sort(
      (left, right) =>
        left.position - right.position ||
        localizedText(left.nameI18n, locale).localeCompare(localizedText(right.nameI18n, locale)),
    )

  return activeCategories.map((category) => ({
    category,
    items: items
      .filter((item) => item.categoryId === category.id)
      .sort((left, right) =>
        localizedText(left.nameI18n, locale).localeCompare(localizedText(right.nameI18n, locale)),
      ),
  }))
}

/** Filters visible menu sections without losing the category context of a matching dish. */
export function filterMenuSections(
  sections: readonly MenuSection[],
  { isActive, kitchenStation, locale, query }: MenuSectionFilters,
): MenuSection[] {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale)
  const hasItemFilters = isActive !== undefined || kitchenStation !== undefined

  return sections.flatMap((section) => {
    const categoryMatches = localizedText(section.category.nameI18n, locale)
      .toLocaleLowerCase(locale)
      .includes(normalizedQuery)
    const items = section.items.filter((item) => {
      const itemMatches = localizedText(item.nameI18n, locale)
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery)
      return (
        (categoryMatches || itemMatches) &&
        (isActive === undefined || item.isActive === isActive) &&
        (kitchenStation === undefined || (item.kitchenStation ?? 'general') === kitchenStation)
      )
    })
    const keepEmptyCategory = Boolean(normalizedQuery) && categoryMatches && !hasItemFilters

    return items.length > 0 || keepEmptyCategory ? [{ ...section, items }] : []
  })
}

/** VAT rates are stored as basis points: 1000 bps → "10 %", 550 bps → "5,5 %". */
export function formatVatRate(vatRateBps: number, locale: Locale): string {
  const rate = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(vatRateBps / 100)
  return `${rate} %`
}
