import { z } from 'zod'

import { KITCHEN_STATIONS, MENU_CHANNELS } from '../domain/menu'

export const menuTenantInput = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid().optional(),
})

const categoryNames = {
  nameCa: z.string().trim().max(100).optional(),
  nameEs: z.string().trim().min(1).max(100),
}

const priceCents = z.number().int().min(0).max(1_000_000)
const vatRateBps = z.number().int().min(0).max(10_000)
const preparationMinutes = z.number().int().min(1).max(240)
const kitchenStation = z.enum(KITCHEN_STATIONS)

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
  preparationMinutes: preparationMinutes.optional(),
  kitchenStation: kitchenStation.optional(),
  sku: z.string().trim().min(1).max(50).optional(),
  vatRateBps,
})

export const updateMenuItemInput = menuTenantInput
  .extend({
    isActive: z.boolean().optional(),
    itemId: z.string().uuid(),
    priceCents: priceCents.optional(),
    preparationMinutes: preparationMinutes.optional(),
    kitchenStation: kitchenStation.optional(),
    vatRateBps: vatRateBps.optional(),
  })
  .refine(
    (input) =>
      input.isActive !== undefined ||
      input.priceCents !== undefined ||
      input.vatRateBps !== undefined ||
      input.preparationMinutes !== undefined ||
      input.kitchenStation !== undefined,
    { message: 'empty_menu_item_update', path: ['itemId'] },
  )

/** La carta la edita la dirección; la sala sólo la consulta. RLS lo refuerza. */
export function requireMenuEditor(role: string): void {
  if (!['owner', 'manager'].includes(role)) throw new Response('Forbidden', { status: 403 })
}

export const createModifierGroupInput = menuTenantInput.extend({
  menuItemId: z.string().uuid(),
  nameCa: z.string().trim().max(100).optional(),
  nameEs: z.string().trim().min(1).max(100),
  selectionMax: z.number().int().min(1).max(20),
  selectionMin: z.number().int().min(0).max(20),
  position: z.number().int().min(0).max(9999).optional(),
})

export const createModifierOptionInput = menuTenantInput.extend({
  groupId: z.string().uuid(),
  nameCa: z.string().trim().max(100).optional(),
  nameEs: z.string().trim().min(1).max(100),
  position: z.number().int().min(0).max(9999).optional(),
  priceDeltaCents: z.number().int().min(-1_000_000).max(1_000_000),
})

export const menuChannelPriceInput = menuTenantInput.extend({
  channel: z.enum(MENU_CHANNELS),
  isAvailable: z.boolean().optional(),
  menuItemId: z.string().uuid(),
  priceCents: z.number().int().min(0).max(1_000_000),
  venueId: z.string().uuid().optional(),
})
