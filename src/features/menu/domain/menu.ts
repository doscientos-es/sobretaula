import { type Locale } from '@/shared/lib/i18n/locale'
import { localizedText, type LocalizedText } from '@/shared/lib/i18n/localized-text'

export { localizedText, type LocalizedText }

export const KITCHEN_STATIONS = ['general', 'hot', 'cold', 'bar', 'dessert'] as const
export type KitchenStation = (typeof KITCHEN_STATIONS)[number]

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
  isVegan?: boolean
  allergenReasons?: Readonly<Record<string, readonly string[]>>
}

export interface MenuSection {
  category: MenuCategory
  items: MenuItem[]
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

/** VAT rates are stored as basis points: 1000 bps → "10 %", 550 bps → "5,5 %". */
export function formatVatRate(vatRateBps: number, locale: Locale): string {
  const rate = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(vatRateBps / 100)
  return `${rate} %`
}
