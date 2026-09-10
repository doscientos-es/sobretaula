export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const
export type Allergen = (typeof ALLERGENS)[number]
export interface RecipeIngredient {
  name: string
  quantity: number
  costCentsPerUnit: number
  wastePercent: number
  allergens: readonly string[]
  isVegan: boolean
}
export interface RecipeCost {
  costCents: number
  allergens: { name: string; reasons: string[] }[]
  isVegan: boolean
}

export function calculateRecipeCost(lines: readonly RecipeIngredient[]): RecipeCost {
  const allergenReasons = new Map<string, string[]>()
  let costCents = 0
  let isVegan = true
  for (const line of lines) {
    costCents += line.quantity * line.costCentsPerUnit * (1 + line.wastePercent / 100)
    if (!line.isVegan) isVegan = false
    for (const allergen of line.allergens)
      allergenReasons.set(allergen, [...(allergenReasons.get(allergen) ?? []), line.name])
  }
  return {
    costCents: Math.round(costCents),
    isVegan,
    allergens: [...allergenReasons]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, reasons]) => ({ name, reasons })),
  }
}
