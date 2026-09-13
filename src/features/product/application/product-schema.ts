import { z } from 'zod'

import { ALLERGENS } from '../domain/product-costing'

export const productTenantInput = z.object({ tenantId: z.string().uuid() })
export const ingredientListInput = productTenantInput.extend({
  venueId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).default(''),
})
export const supplierListInput = productTenantInput.extend({
  venueId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).default(''),
})
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
export const supplierInput = productTenantInput.extend({
  name: z.string().trim().min(1).max(160),
  taxId: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(254).optional(),
})
export const deliveryNoteInput = inventoryQueryInput.extend({
  supplierId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional(),
  reference: z.string().trim().min(1).max(120),
  receivedOn: z.string().date(),
  notes: z.string().trim().max(1000).default(''),
  lines: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        quantity: z.number().positive().max(1_000_000),
        unitCostCents: z.number().min(0).max(1_000_000),
      }),
    )
    .min(1)
    .max(500),
})
export const receiveDeliveryNoteInput = z.object({
  tenantId: z.string().uuid(),
  deliveryNoteId: z.string().uuid(),
})
export const purchaseOrderInput = inventoryQueryInput.extend({
  supplierId: z.string().uuid(),
  notes: z.string().trim().max(1000).default(''),
  lines: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        quantity: z.number().positive(),
        unitCostCents: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(500),
})
export const purchaseOrderStatusInput = productTenantInput.extend({
  purchaseOrderId: z.string().uuid(),
  status: z.enum(['approved', 'sent', 'received', 'cancelled']),
})
export const purchaseOrderListInput = inventoryQueryInput.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
})

export function requireProductEditor(role: string): void {
  if (!['owner', 'manager'].includes(role)) throw new Response('Forbidden', { status: 403 })
}
