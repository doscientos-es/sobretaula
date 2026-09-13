import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { createAnonSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { LocalizedText } from '../domain/menu'
import type { MenuCatalog } from './menu'

export const getPublicMenu = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      slug: z.string().min(1).max(100),
      channel: z.enum(['room', 'web', 'delivery', 'takeaway']).default('web'),
    }),
  )
  .handler(async ({ data }): Promise<MenuCatalog> => {
    const client = createAnonSupabaseClient()
    let { data: rows, error } = await client.rpc('public_menu_by_slug_v3', {
      p_slug: data.slug,
      p_channel: data.channel,
    })
    if (error?.code === '42883' || error?.code === 'PGRST202') {
      const fallback = await client.rpc('public_menu_by_slug_v2', {
        p_slug: data.slug,
        p_channel: data.channel,
      })
      rows = fallback.data
      error = fallback.error
    }
    if (error) throw new Error(`public_menu_load_failed:${error.code}`)
    type PublicMenuRow = {
      allergen_reasons?: Record<string, string[]>
      allergens?: string[]
      category_id: string
      category_name_i18n: unknown
      category_position: number
      is_vegan?: boolean
      item_description_i18n: unknown
      item_id: string
      item_is_active: boolean
      item_name_i18n: unknown
      price_cents: number
      vat_rate_bps: number
      modifier_groups?: unknown
    }
    const typedRows = (rows ?? []) as PublicMenuRow[]
    const categories = new Map<
      string,
      { id: string; isActive: boolean; nameI18n: LocalizedText; position: number }
    >()
    for (const row of typedRows) {
      if (!categories.has(row.category_id))
        categories.set(row.category_id, {
          id: row.category_id,
          isActive: true,
          nameI18n: row.category_name_i18n as LocalizedText,
          position: row.category_position,
        })
    }
    return {
      categories: [...categories.values()],
      items: typedRows.map((row) => ({
        categoryId: row.category_id,
        descriptionI18n: row.item_description_i18n as LocalizedText,
        id: row.item_id,
        isActive: row.item_is_active,
        nameI18n: row.item_name_i18n as LocalizedText,
        priceCents: row.price_cents,
        vatRateBps: row.vat_rate_bps,
        sku: null,
        allergens: row.allergens ?? [],
        allergenReasons: row.allergen_reasons ?? {},
        isVegan: Boolean(row.is_vegan),
        modifierGroups: Array.isArray(row.modifier_groups)
          ? (row.modifier_groups as Array<Record<string, unknown>>).map((group) => ({
              id: String(group.id),
              isActive: Boolean(group.is_active),
              nameI18n: group.name_i18n as LocalizedText,
              options: (Array.isArray(group.options) ? group.options : []).map((option) => {
                const value = option as Record<string, unknown>
                return {
                  id: String(value.id),
                  isActive: Boolean(value.is_active),
                  nameI18n: value.name_i18n as LocalizedText,
                  position: Number(value.position ?? 0),
                  priceDeltaCents: Number(value.price_delta_cents ?? 0),
                  allergens: Array.isArray(value.allergens) ? (value.allergens as string[]) : [],
                  isVegan: Boolean(value.is_vegan),
                }
              }),
              position: Number(group.position ?? 0),
              selectionMin: Number(group.selection_min ?? 0),
              selectionMax: Number(group.selection_max ?? 1),
            }))
          : [],
      })),
    }
  })
