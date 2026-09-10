import { z } from 'zod'

import { ALLERGENS } from '../domain/product-costing'

export const productTenantInput = z.object({ tenantId: z.string().uuid() })
export const createIngredientInput = productTenantInput.extend({
  name: z.string().trim().min(1).max(120),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'unit']),
  costCentsPerUnit: z.number().min(0).max(1_000_000),
  allergens: z.array(z.enum(ALLERGENS)).max(14).default([]),
  isVegan: z.boolean().default(false),
  minimumStock: z.number().min(0).max(1_000_000).default(0),
})
export const recipeInput = productTenantInput.extend({
  menuItemId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        quantity: z.number().positive().max(1_000_000),
        wastePercent: z.number().min(0).max(100).default(0),
      }),
    )
    .max(500),
})
export const recipeQueryInput = productTenantInput.extend({ menuItemId: z.string().uuid() })
export const recipeVersionsInput = recipeQueryInput
export const restoreRecipeVersionInput = recipeQueryInput.extend({
  version: z.number().int().positive(),
})
export const channelPriceInput = productTenantInput.extend({
  menuItemId: z.string().uuid(),
  channel: z.enum(['room', 'web', 'delivery', 'takeaway']),
  priceCents: z.number().int().min(0).max(1_000_000),
})
export const inventoryQueryInput = productTenantInput.extend({ venueId: z.string().uuid() })
export const inventoryMovementInput = inventoryQueryInput.extend({
  ingredientId: z.string().uuid(),
  kind: z.enum(['purchase', 'sale', 'waste', 'adjustment']),
  quantity: z
    .number()
    .max(1_000_000)
    .refine((value) => value !== 0),
  unitCostCents: z.number().min(0).max(1_000_000).optional(),
  reason: z.string().trim().min(2).max(200),
})

export function requireProductEditor(role: string): void {
  if (!['owner', 'manager'].includes(role)) throw new Response('Forbidden', { status: 403 })
}
