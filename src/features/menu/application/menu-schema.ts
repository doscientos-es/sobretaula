import { z } from 'zod'

export const menuTenantInput = z.object({ tenantId: z.string().uuid() })

const categoryNames = {
  nameCa: z.string().trim().max(100).optional(),
  nameEs: z.string().trim().min(1).max(100),
}

const priceCents = z.number().int().min(0).max(1_000_000)
const vatRateBps = z.number().int().min(0).max(10_000)

export const createMenuCategoryInput = menuTenantInput.extend({
  ...categoryNames,
  position: z.number().int().min(0).max(9999).optional(),
})

export const createMenuItemInput = menuTenantInput.extend({
  ...categoryNames,
  categoryId: z.string().uuid(),
  descriptionCa: z.string().trim().max(500).optional(),
  descriptionEs: z.string().trim().max(500).optional(),
  priceCents,
  sku: z.string().trim().min(1).max(50).optional(),
  vatRateBps,
})

export const updateMenuItemInput = menuTenantInput
  .extend({
    isActive: z.boolean().optional(),
    itemId: z.string().uuid(),
    priceCents: priceCents.optional(),
    vatRateBps: vatRateBps.optional(),
  })
  .refine(
    (input) =>
      input.isActive !== undefined ||
      input.priceCents !== undefined ||
      input.vatRateBps !== undefined,
    { message: 'empty_menu_item_update', path: ['itemId'] },
  )

/** La carta la edita la dirección; la sala sólo la consulta. RLS lo refuerza. */
export function requireMenuEditor(role: string): void {
  if (!['owner', 'manager'].includes(role)) throw new Response('Forbidden', { status: 403 })
}
