import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { LocalizedText, MenuCategory, MenuItem } from '../domain/menu'
import {
  createMenuCategoryInput,
  createMenuItemInput,
  menuTenantInput,
  requireMenuEditor,
  updateMenuItemInput,
} from './menu-schema'

export interface MenuCatalog {
  categories: MenuCategory[]
  items: MenuItem[]
}

function localizedName(nameEs: string, nameCa?: string): LocalizedText {
  return nameCa ? { ca: nameCa, es: nameEs } : { es: nameEs }
}

function localizedDescription(descriptionEs?: string, descriptionCa?: string): LocalizedText {
  const description: LocalizedText = {}
  if (descriptionEs) description.es = descriptionEs
  if (descriptionCa) description.ca = descriptionCa
  return description
}

/** Whole catalog of the tenant: the carta is shared by every venue. */
export const getMenu = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(menuTenantInput)
  .handler(async ({ context, data }): Promise<MenuCatalog> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [categoriesResult, itemsResult] = await Promise.all([
      supabase
        .from('menu_categories')
        .select('id, is_active, name_i18n, position')
        .eq('tenant_id', data.tenantId)
        .order('position'),
      supabase
        .from('menu_items')
        .select(
          'category_id, description_i18n, id, is_active, name_i18n, price_cents, sku, vat_rate_bps',
        )
        .eq('tenant_id', data.tenantId),
    ])
    const error = categoriesResult.error ?? itemsResult.error
    if (error) throw new Error(`menu_load_failed:${error.code}`)

    return {
      categories: (categoriesResult.data ?? []).map((category) => ({
        id: category.id as string,
        isActive: category.is_active as boolean,
        nameI18n: (category.name_i18n ?? {}) as LocalizedText,
        position: category.position as number,
      })),
      items: (itemsResult.data ?? []).map((item) => ({
        categoryId: item.category_id as string,
        descriptionI18n: (item.description_i18n ?? {}) as LocalizedText,
        id: item.id as string,
        isActive: item.is_active as boolean,
        nameI18n: (item.name_i18n ?? {}) as LocalizedText,
        priceCents: item.price_cents as number,
        sku: (item.sku as string | null) ?? null,
        vatRateBps: item.vat_rate_bps as number,
      })),
    }
  })

export const createMenuCategory = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(createMenuCategoryInput)
  .handler(async ({ context, data }) => {
    requireMenuEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: category, error } = await supabase
      .from('menu_categories')
      .insert({
        name_i18n: localizedName(data.nameEs, data.nameCa),
        position: data.position ?? 0,
        tenant_id: data.tenantId,
      })
      .select('id')
      .single()
    if (error || !category)
      throw new Error(`menu_category_create_failed:${error?.code ?? 'unknown'}`)
    return { categoryId: category.id as string }
  })

export const createMenuItem = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(createMenuItemInput)
  .handler(async ({ context, data }) => {
    requireMenuEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: category, error: categoryError } = await supabase
      .from('menu_categories')
      .select('id')
      .eq('id', data.categoryId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (categoryError || !category) throw new Response('Not found', { status: 404 })

    const { data: item, error } = await supabase
      .from('menu_items')
      .insert({
        category_id: data.categoryId,
        description_i18n: localizedDescription(data.descriptionEs, data.descriptionCa),
        name_i18n: localizedName(data.nameEs, data.nameCa),
        price_cents: data.priceCents,
        sku: data.sku ?? null,
        tenant_id: data.tenantId,
        vat_rate_bps: data.vatRateBps,
      })
      .select('id')
      .single()
    if (error || !item) {
      if (error?.code === '23505') throw new Response('Duplicate SKU', { status: 409 })
      throw new Error(`menu_item_create_failed:${error?.code ?? 'unknown'}`)
    }
    return { itemId: item.id as string }
  })

/** Price, VAT and availability changes; names are fixed once the item is in use. */
export const updateMenuItem = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(updateMenuItemInput)
  .handler(async ({ context, data }) => {
    requireMenuEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const update: Record<string, boolean | number> = {}
    if (data.isActive !== undefined) update.is_active = data.isActive
    if (data.priceCents !== undefined) update.price_cents = data.priceCents
    if (data.vatRateBps !== undefined) update.vat_rate_bps = data.vatRateBps

    const { data: updated, error } = await supabase
      .from('menu_items')
      .update(update)
      .eq('id', data.itemId)
      .eq('tenant_id', data.tenantId)
      .select('id')
    if (error) throw new Error(`menu_item_update_failed:${error.code}`)
    if (!updated?.length) throw new Response('Not found', { status: 404 })
    return { itemId: data.itemId }
  })
