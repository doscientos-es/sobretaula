import { createServerFn } from '@tanstack/react-start'
import { createAnonSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'
import { z } from 'zod'
import type { MenuCatalog } from './menu'
import type { LocalizedText } from '../domain/menu'

export const getPublicMenu = createServerFn({ method: 'GET' }).validator(z.object({ slug: z.string().min(1).max(100), channel: z.enum(['room', 'web', 'delivery', 'takeaway']).default('web') })).handler(async ({ data }): Promise<MenuCatalog> => {
  const { data: rows, error } = await createAnonSupabaseClient().rpc('public_menu_by_slug_v2', { p_slug: data.slug, p_channel: data.channel })
  if (error) throw new Error(`public_menu_load_failed:${error.code}`)
  type PublicMenuRow = { allergen_reasons?: Record<string, string[]>; allergens?: string[]; category_id: string; category_name_i18n: unknown; category_position: number; is_vegan?: boolean; item_description_i18n: unknown; item_id: string; item_is_active: boolean; item_name_i18n: unknown; price_cents: number; vat_rate_bps: number }
  const typedRows = (rows ?? []) as PublicMenuRow[]
  const categories = new Map<string, { id: string; isActive: boolean; nameI18n: LocalizedText; position: number }>()
  for (const row of typedRows) {
    if (!categories.has(row.category_id)) categories.set(row.category_id, { id: row.category_id, isActive: true, nameI18n: row.category_name_i18n as LocalizedText, position: row.category_position })
  }
  return { categories: [...categories.values()], items: typedRows.map((row) => ({ categoryId: row.category_id, descriptionI18n: row.item_description_i18n as LocalizedText, id: row.item_id, isActive: row.item_is_active, nameI18n: row.item_name_i18n as LocalizedText, priceCents: row.price_cents, vatRateBps: row.vat_rate_bps, sku: null, allergens: row.allergens ?? [], allergenReasons: row.allergen_reasons ?? {}, isVegan: Boolean(row.is_vegan) })) }
})
