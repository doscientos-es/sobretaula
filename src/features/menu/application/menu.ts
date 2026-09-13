import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { LocalizedText, MenuCategory, MenuItem, MenuModifierOption } from '../domain/menu'
import { previewMenuCsv } from '../domain/menu-import'
import {
  createModifierGroupInput,
  createModifierOptionInput,
  createMenuCategoryInput,
  createMenuItemInput,
  menuTenantInput,
  requireMenuEditor,
  updateMenuItemInput,
} from './menu-schema'

const importMenuCsvInput = menuTenantInput.extend({ csv: z.string().min(1).max(1_000_000) })

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
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(menuTenantInput)
  .handler(async ({ context, data }): Promise<MenuCatalog> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [
      categoriesResult,
      itemsResult,
      modifierGroupsResult,
      modifierOptionsResult,
      venuePricesResult,
    ] = await Promise.all([
      supabase
        .from('menu_categories')
        .select('id, is_active, name_i18n, position')
        .eq('tenant_id', data.tenantId)
        .order('position'),
      supabase
        .from('menu_items')
        .select(
          'category_id, description_i18n, id, is_active, kitchen_station, name_i18n, preparation_minutes, price_cents, sku, vat_rate_bps',
        )
        .eq('tenant_id', data.tenantId),
      supabase
        .from('menu_modifier_groups')
        .select('id, is_active, menu_item_id, name_i18n, position, selection_max, selection_min')
        .eq('tenant_id', data.tenantId)
        .eq('is_active', true)
        .order('position'),
      supabase
        .from('menu_modifier_options')
        .select('group_id, id, is_active, name_i18n, position, price_delta_cents')
        .eq('tenant_id', data.tenantId)
        .eq('is_active', true)
        .order('position'),
      data.venueId
        ? supabase
            .from('menu_item_venue_prices')
            .select('is_available, menu_item_id, price_cents')
            .eq('tenant_id', data.tenantId)
            .eq('venue_id', data.venueId)
            .eq('channel', 'room')
        : Promise.resolve({ data: [], error: null }),
    ])
    let finalItemsResult = itemsResult
    if (itemsResult.error?.code === '42703') {
      const legacy = await supabase
        .from('menu_items')
        .select(
          'category_id, description_i18n, id, is_active, name_i18n, price_cents, sku, vat_rate_bps',
        )
        .eq('tenant_id', data.tenantId)
      finalItemsResult = {
        ...legacy,
        data: (legacy.data ?? []).map((item) => ({
          ...item,
          kitchen_station: 'general',
          preparation_minutes: 15,
        })),
      } as typeof finalItemsResult
    }
    const error =
      categoriesResult.error ??
      finalItemsResult.error ??
      modifierGroupsResult.error ??
      modifierOptionsResult.error ??
      venuePricesResult.error
    if (error) throw new Error(`menu_load_failed:${error.code}`)

    const optionsByGroup = new Map<string, MenuModifierOption[]>()
    for (const option of modifierOptionsResult.data ?? []) {
      const current = optionsByGroup.get(option.group_id as string) ?? []
      current.push({
        id: option.id as string,
        isActive: Boolean(option.is_active),
        nameI18n: (option.name_i18n ?? {}) as LocalizedText,
        position: Number(option.position),
        priceDeltaCents: Number(option.price_delta_cents),
      })
      optionsByGroup.set(option.group_id as string, current)
    }
    const groupsByItem = new Map<string, NonNullable<MenuItem['modifierGroups']>>()
    for (const group of modifierGroupsResult.data ?? []) {
      const current = groupsByItem.get(group.menu_item_id as string) ?? []
      current.push({
        id: group.id as string,
        isActive: Boolean(group.is_active),
        nameI18n: (group.name_i18n ?? {}) as LocalizedText,
        options: optionsByGroup.get(group.id as string) ?? [],
        position: Number(group.position),
        selectionMax: Number(group.selection_max),
        selectionMin: Number(group.selection_min),
      })
      groupsByItem.set(group.menu_item_id as string, current)
    }
    const venuePriceByItem = new Map(
      (venuePricesResult.data ?? []).map((row) => [row.menu_item_id as string, row]),
    )

    return {
      categories: (categoriesResult.data ?? []).map((category) => ({
        id: category.id as string,
        isActive: category.is_active as boolean,
        nameI18n: (category.name_i18n ?? {}) as LocalizedText,
        position: category.position as number,
      })),
      items: (finalItemsResult.data ?? []).map((item) => ({
        categoryId: item.category_id as string,
        descriptionI18n: (item.description_i18n ?? {}) as LocalizedText,
        id: item.id as string,
        isActive: Boolean(item.is_active),
        isAvailable: venuePriceByItem.get(item.id as string)?.is_available ?? true,
        nameI18n: (item.name_i18n ?? {}) as LocalizedText,
        priceCents: Number(
          venuePriceByItem.get(item.id as string)?.price_cents ?? item.price_cents,
        ),
        preparationMinutes: item.preparation_minutes as number,
        kitchenStation: (item.kitchen_station as MenuItem['kitchenStation']) ?? 'general',
        sku: (item.sku as string | null) ?? null,
        vatRateBps: item.vat_rate_bps as number,
        modifierGroups: groupsByItem.get(item.id as string) ?? [],
      })),
    }
  })

export const createModifierGroup = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(createModifierGroupInput)
  .handler(async ({ context, data }) => {
    requireMenuEditor(context.tenantMembership.role)
    if (data.selectionMin > data.selectionMax)
      throw new Response('Invalid selection', { status: 422 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select('id')
      .eq('id', data.menuItemId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (itemError || !item) throw new Response('Not found', { status: 404 })
    const { data: group, error } = await supabase
      .from('menu_modifier_groups')
      .insert({
        menu_item_id: data.menuItemId,
        name_i18n: localizedName(data.nameEs, data.nameCa),
        position: data.position ?? 0,
        selection_max: data.selectionMax,
        selection_min: data.selectionMin,
        tenant_id: data.tenantId,
      })
      .select('id')
      .single()
    if (error || !group) throw new Error(`modifier_group_create_failed:${error?.code ?? 'unknown'}`)
    return { groupId: group.id as string }
  })

export const createModifierOption = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(createModifierOptionInput)
  .handler(async ({ context, data }) => {
    requireMenuEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: group, error: groupError } = await supabase
      .from('menu_modifier_groups')
      .select('id')
      .eq('id', data.groupId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (groupError || !group) throw new Response('Not found', { status: 404 })
    const { data: option, error } = await supabase
      .from('menu_modifier_options')
      .insert({
        group_id: data.groupId,
        name_i18n: localizedName(data.nameEs, data.nameCa),
        position: data.position ?? 0,
        price_delta_cents: data.priceDeltaCents,
        ingredient_id: data.ingredientId ?? null,
        replaces_ingredient_id: data.replacesIngredientId ?? null,
        tenant_id: data.tenantId,
      })
      .select('id')
      .single()
    if (error || !option)
      throw new Error(`modifier_option_create_failed:${error?.code ?? 'unknown'}`)
    return { optionId: option.id as string }
  })

export const createMenuCategory = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
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
  .middleware([authMiddleware, tenantMembershipMiddleware])
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

    let itemResult = await supabase
      .from('menu_items')
      .insert({
        category_id: data.categoryId,
        description_i18n: localizedDescription(data.descriptionEs, data.descriptionCa),
        name_i18n: localizedName(data.nameEs, data.nameCa),
        price_cents: data.priceCents,
        preparation_minutes: data.preparationMinutes ?? 15,
        kitchen_station: data.kitchenStation ?? 'general',
        sku: data.sku ?? null,
        tenant_id: data.tenantId,
        vat_rate_bps: data.vatRateBps,
      })
      .select('id')
      .single()
    if (itemResult.error?.code === '42703') {
      const legacy = await supabase
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
      itemResult = legacy
    }
    const { data: item, error } = itemResult
    if (error || !item) {
      if (error?.code === '23505') throw new Response('Duplicate SKU', { status: 409 })
      throw new Error(`menu_item_create_failed:${error?.code ?? 'unknown'}`)
    }
    return { itemId: item.id as string }
  })

export const importMenuCsv = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(importMenuCsvInput)
  .handler(async ({ context, data }) => {
    requireMenuEditor(context.tenantMembership.role)
    const preview = previewMenuCsv(data.csv)
    if (preview.errors.length || preview.rows.length === 0) {
      throw new Response('Invalid CSV', { status: 422 })
    }
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: existingCategories, error: categoryError } = await supabase
      .from('menu_categories')
      .select('id, name_i18n')
      .eq('tenant_id', data.tenantId)
    if (categoryError) throw new Error(`menu_import_categories_load_failed:${categoryError.code}`)
    const categoryIds = new Map(
      (existingCategories ?? []).map((category) => [
        String((category.name_i18n as { es?: string } | null)?.es ?? '')
          .trim()
          .toLowerCase(),
        category.id as string,
      ]),
    )
    let categoriesCreated = 0
    let itemsCreated = 0
    for (const row of preview.rows) {
      const categoryKey = row.category.toLowerCase()
      let categoryId = categoryIds.get(categoryKey)
      if (!categoryId) {
        const created = await supabase
          .from('menu_categories')
          .insert({
            name_i18n: { es: row.category },
            position: categoryIds.size,
            tenant_id: data.tenantId,
          })
          .select('id')
          .single()
        if (created.error || !created.data)
          throw new Error(`menu_import_category_failed:${created.error?.code ?? 'unknown'}`)
        categoryId = created.data.id as string
        categoryIds.set(categoryKey, categoryId)
        categoriesCreated += 1
      }
      const createdItem = await supabase
        .from('menu_items')
        .insert({
          category_id: categoryId,
          description_i18n: row.descriptionEs ? { es: row.descriptionEs } : {},
          name_i18n: { es: row.nameEs },
          price_cents: row.priceCents,
          sku: row.sku ?? null,
          tenant_id: data.tenantId,
          vat_rate_bps: row.vatRateBps,
        })
        .select('id')
        .single()
      if (createdItem.error || !createdItem.data) {
        if (createdItem.error?.code === '23505')
          throw new Response('Duplicate SKU', { status: 409 })
        throw new Error(`menu_import_item_failed:${createdItem.error?.code ?? 'unknown'}`)
      }
      itemsCreated += 1
    }
    return { categoriesCreated, itemsCreated }
  })

/** Price, VAT and availability changes; names are fixed once the item is in use. */
export const updateMenuItem = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(updateMenuItemInput)
  .handler(async ({ context, data }) => {
    requireMenuEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const update: Record<string, boolean | number | string> = {}
    if (data.isActive !== undefined) update.is_active = data.isActive
    if (data.priceCents !== undefined) update.price_cents = data.priceCents
    if (data.preparationMinutes !== undefined) update.preparation_minutes = data.preparationMinutes
    if (data.kitchenStation !== undefined) update.kitchen_station = data.kitchenStation
    if (data.vatRateBps !== undefined) update.vat_rate_bps = data.vatRateBps

    let updateResult = await supabase
      .from('menu_items')
      .update(update)
      .eq('id', data.itemId)
      .eq('tenant_id', data.tenantId)
      .select('id')
    if (updateResult.error?.code === '42703') {
      const legacyUpdate = { ...update }
      delete legacyUpdate.preparation_minutes
      delete legacyUpdate.kitchen_station
      updateResult = await supabase
        .from('menu_items')
        .update(legacyUpdate)
        .eq('id', data.itemId)
        .eq('tenant_id', data.tenantId)
        .select('id')
    }
    const { data: updated, error } = updateResult
    if (error) throw new Error(`menu_item_update_failed:${error.code}`)
    if (!updated?.length) throw new Response('Not found', { status: 404 })
    return { itemId: data.itemId }
  })
