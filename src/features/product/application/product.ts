import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { paginationRange, type PaginatedResult } from '@/shared/lib/pagination'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { validateDeliveryNoteLines } from '../domain/delivery-notes'
import { calculateRecipeAvailability, calculateStock, findLowStock } from '../domain/inventory'
import { calculateRecipeCost } from '../domain/product-costing'
import { canAdvancePurchaseOrder, validatePurchaseOrderLines } from '../domain/purchase-order'
import {
  createIngredientInput,
  deliveryNoteInput,
  ingredientListInput,
  inventoryMovementInput,
  inventoryQueryInput,
  recipeInput,
  recipeQueryInput,
  recipeVersionsInput,
  receiveDeliveryNoteInput,
  purchaseOrderInput,
  purchaseOrderStatusInput,
  purchaseOrderListInput,
  restoreRecipeVersionInput,
  requireProductEditor,
  supplierInput,
  supplierListInput,
} from './product-schema'

const middleware = [
  authMiddleware,
  tenantMembershipMiddleware,
  operationalTenantMiddleware,
] as const

export const listIngredients = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(ingredientListInput)
  .handler(
    async ({
      context,
      data,
    }): Promise<
      PaginatedResult<{
        id: string
        name: string
        unit: string
        costCentsPerUnit: number
        allergens: string[]
        isVegan: boolean
        isActive: boolean
        minimumStock: number
      }>
    > => {
      requireProductEditor(context.tenantMembership.role)
      const { from, to } = paginationRange(data)
      const {
        data: rows,
        error,
        count,
      } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
        .from('ingredients')
        .select(
          'id, name, unit, cost_cents_per_unit, allergens, is_vegan, is_active, minimum_stock',
        )
        .eq('tenant_id', data.tenantId)
        .ilike('name', `%${data.search}%`)
        .order('name')
        .range(from, to)
      if (error) throw new Error(`ingredients_load_failed:${error.code}`)
      const items = (rows ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        unit: row.unit as string,
        costCentsPerUnit: Number(row.cost_cents_per_unit),
        allergens: (row.allergens as string[]) ?? [],
        isVegan: Boolean(row.is_vegan),
        isActive: Boolean(row.is_active),
        minimumStock: Number(row.minimum_stock ?? 0),
      }))
      const total = count ?? items.length
      return { items, page: data.page, pageSize: data.pageSize, total, hasMore: to + 1 < total }
    },
  )

export const listSuppliers = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(supplierListInput)
  .handler(
    async ({
      context,
      data,
    }): Promise<
      PaginatedResult<{
        id: string
        name: string
        taxId: string | null
        phone: string | null
        email: string | null
      }>
    > => {
      requireProductEditor(context.tenantMembership.role)
      const range = paginationRange(data)
      let request = createRequestSupabaseClient(context.tenantMembership.accessToken)
        .from('suppliers')
        .select('id, name, tax_id, phone, email', { count: 'exact' })
        .eq('tenant_id', data.tenantId)
        .eq('is_active', true)
        .order('name')
        .range(range.from, range.to)
      if (data.search) request = request.ilike('name', `%${data.search}%`)
      const { data: rows, error, count } = await request
      if (error) throw new Error(`suppliers_load_failed:${error.code}`)
      const items = (rows ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        taxId: row.tax_id as string | null,
        phone: row.phone as string | null,
        email: row.email as string | null,
      }))
      return {
        items,
        page: data.page,
        pageSize: data.pageSize,
        total: count ?? 0,
        hasMore: range.to < (count ?? 0) - 1,
      }
    },
  )

export const createIngredient = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(createIngredientInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const { data: row, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('ingredients')
      .insert({
        tenant_id: data.tenantId,
        name: data.name,
        unit: data.unit,
        cost_cents_per_unit: data.costCentsPerUnit,
        allergens: data.allergens,
        is_vegan: data.isVegan,
        minimum_stock: data.minimumStock,
      })
      .select('id')
      .single()
    if (error || !row) throw new Error(`ingredient_create_failed:${error?.code ?? 'unknown'}`)
    return { ingredientId: row.id as string }
  })

export const replaceRecipe = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(recipeInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: menuItem, error: menuError } = await supabase
      .from('menu_items')
      .select('id')
      .eq('id', data.menuItemId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (menuError || !menuItem) throw new Response('Not found', { status: 404 })
    const { data: previousLines, error: previousError } = await supabase
      .from('recipe_ingredients')
      .select('ingredient_id, quantity, waste_percent')
      .eq('tenant_id', data.tenantId)
      .eq('menu_item_id', data.menuItemId)
    if (previousError && previousError.code !== '42P01')
      throw new Error(`recipe_previous_load_failed:${previousError.code}`)
    if (previousLines?.length) {
      const { data: latest } = await supabase
        .from('recipe_versions')
        .select('version')
        .eq('tenant_id', data.tenantId)
        .eq('menu_item_id', data.menuItemId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { error: versionError } = await supabase.from('recipe_versions').insert({
        tenant_id: data.tenantId,
        menu_item_id: data.menuItemId,
        version: Number(latest?.version ?? 0) + 1,
        lines: previousLines,
        created_by: context.tenantMembership.userId,
      })
      if (versionError) throw new Error(`recipe_version_create_failed:${versionError.code}`)
    }
    const { error: deleteError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('menu_item_id', data.menuItemId)
      .eq('tenant_id', data.tenantId)
    if (deleteError) throw new Error(`recipe_replace_failed:${deleteError.code}`)
    if (data.lines.length) {
      const { error } = await supabase.from('recipe_ingredients').insert(
        data.lines.map((line) => ({
          tenant_id: data.tenantId,
          menu_item_id: data.menuItemId,
          ingredient_id: line.ingredientId,
          quantity: line.quantity,
          waste_percent: line.wastePercent,
        })),
      )
      if (error) throw new Error(`recipe_lines_create_failed:${error.code}`)
    }
    return { menuItemId: data.menuItemId, lineCount: data.lines.length }
  })

export const getRecipeCost = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(recipeQueryInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: rows, error } = await supabase
      .from('recipe_ingredients')
      .select(
        'quantity, waste_percent, ingredients!inner(name, cost_cents_per_unit, allergens, is_vegan)',
      )
      .eq('tenant_id', data.tenantId)
      .eq('menu_item_id', data.menuItemId)
    if (error) throw new Error(`recipe_cost_load_failed:${error.code}`)
    return calculateRecipeCost(
      (rows ?? []).map((row) => {
        const ingredient = (
          row.ingredients as {
            name: string
            cost_cents_per_unit: number
            allergens: string[]
            is_vegan: boolean
          }[]
        )[0]
        return {
          name: ingredient?.name ?? 'Ingrediente',
          quantity: Number(row.quantity),
          costCentsPerUnit: Number(ingredient?.cost_cents_per_unit ?? 0),
          wastePercent: Number(row.waste_percent),
          allergens: ingredient?.allergens ?? [],
          isVegan: Boolean(ingredient?.is_vegan),
        }
      }),
    )
  })

export const listRecipeVersions = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(recipeVersionsInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const { data: rows, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('recipe_versions')
      .select('id, version, lines, created_at')
      .eq('tenant_id', data.tenantId)
      .eq('menu_item_id', data.menuItemId)
      .order('version', { ascending: false })
    if (error) throw new Error(`recipe_versions_load_failed:${error.code}`)
    return rows ?? []
  })

export const restoreRecipeVersion = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(restoreRecipeVersionInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: version, error: versionError } = await supabase
      .from('recipe_versions')
      .select('lines')
      .eq('tenant_id', data.tenantId)
      .eq('menu_item_id', data.menuItemId)
      .eq('version', data.version)
      .single()
    if (versionError || !version) throw new Response('Recipe version not found', { status: 404 })
    const lines = (
      version.lines as { ingredient_id: string; quantity: number; waste_percent: number }[]
    ).map((line) => ({
      ingredientId: line.ingredient_id,
      quantity: Number(line.quantity),
      wastePercent: Number(line.waste_percent ?? 0),
    }))
    const current = await supabase
      .from('recipe_ingredients')
      .select('ingredient_id, quantity, waste_percent')
      .eq('tenant_id', data.tenantId)
      .eq('menu_item_id', data.menuItemId)
    if (current.error) throw new Error(`recipe_current_load_failed:${current.error.code}`)
    if (current.data?.length) {
      const latest = await supabase
        .from('recipe_versions')
        .select('version')
        .eq('tenant_id', data.tenantId)
        .eq('menu_item_id', data.menuItemId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { error } = await supabase.from('recipe_versions').insert({
        tenant_id: data.tenantId,
        menu_item_id: data.menuItemId,
        version: Number(latest.data?.version ?? 0) + 1,
        lines: current.data,
        created_by: context.tenantMembership.userId,
      })
      if (error) throw new Error(`recipe_version_create_failed:${error.code}`)
    }
    await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('tenant_id', data.tenantId)
      .eq('menu_item_id', data.menuItemId)
    if (lines.length) {
      const { error } = await supabase.from('recipe_ingredients').insert(
        lines.map((line) => ({
          tenant_id: data.tenantId,
          menu_item_id: data.menuItemId,
          ingredient_id: line.ingredientId,
          quantity: line.quantity,
          waste_percent: line.wastePercent,
        })),
      )
      if (error) throw new Error(`recipe_restore_failed:${error.code}`)
    }
    return { menuItemId: data.menuItemId, restoredVersion: data.version }
  })

export const getInventory = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(inventoryQueryInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const aggregate = await supabase.rpc('inventory_stock_by_venue', {
      p_tenant_id: data.tenantId,
      p_venue_id: data.venueId,
    })
    let movements: Array<{ ingredient_id: string; quantity: number }> = aggregate.data ?? []
    if (aggregate.error?.code === '42883' || aggregate.error?.code === 'PGRST202') {
      const fallback = await supabase
        .from('inventory_movements')
        .select('ingredient_id, quantity')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
      if (fallback.error) throw new Error(`inventory_load_failed:${fallback.error.code}`)
      movements = (fallback.data ?? []) as Array<{ ingredient_id: string; quantity: number }>
    } else if (aggregate.error) throw new Error(`inventory_load_failed:${aggregate.error.code}`)
    const stock = calculateStock(
      (movements ?? []).map((movement) => ({
        ingredientId: movement.ingredient_id as string,
        quantity: Number(movement.quantity),
      })),
    )
    const ingredients = await supabase
      .from('ingredients')
      .select('id, minimum_stock')
      .eq('tenant_id', data.tenantId)
      .eq('is_active', true)
    if (ingredients.error)
      throw new Error(`inventory_minimums_load_failed:${ingredients.error.code}`)
    const recipesResult = await supabase
      .from('recipe_ingredients')
      .select('menu_item_id, ingredient_id, quantity')
      .eq('tenant_id', data.tenantId)
    if (recipesResult.error && recipesResult.error.code !== '42P01')
      throw new Error(`inventory_recipes_load_failed:${recipesResult.error.code}`)
    const recipes: Record<string, { ingredientId: string; quantity: number }[]> = {}
    for (const line of recipesResult.data ?? []) {
      ;(recipes[line.menu_item_id as string] ??= []).push({
        ingredientId: line.ingredient_id as string,
        quantity: Number(line.quantity),
      })
    }
    return {
      stock,
      recipeAvailability: calculateRecipeAvailability(stock, recipes),
      lowStockIngredientIds: findLowStock(
        stock,
        (ingredients.data ?? []).map((row) => ({
          ingredientId: row.id as string,
          minimum: Number(row.minimum_stock ?? 0),
        })),
      ),
    }
  })

export const addInventoryMovement = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(inventoryMovementInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: row, error } = await supabase
      .from('inventory_movements')
      .insert({
        tenant_id: data.tenantId,
        venue_id: data.venueId,
        ingredient_id: data.ingredientId,
        kind: data.kind,
        quantity: data.quantity,
        waste_reason: data.wasteReason ?? null,
        unit_cost_cents: data.unitCostCents ?? null,
        reason: data.reason,
        created_by: context.tenantMembership.userId,
      })
      .select('id')
      .single()
    if (error || !row) throw new Error(`inventory_movement_failed:${error?.code ?? 'unknown'}`)
    return { movementId: row.id as string }
  })

export const createSupplier = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(supplierInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const { data: row, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('suppliers')
      .insert({
        tenant_id: data.tenantId,
        name: data.name,
        tax_id: data.taxId ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
      })
      .select('id')
      .single()
    if (error || !row) throw new Error(`supplier_create_failed:${error?.code ?? 'unknown'}`)
    return { supplierId: row.id as string }
  })

export const createDeliveryNote = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(deliveryNoteInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    validateDeliveryNoteLines(data.lines)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: note, error } = await supabase
      .from('delivery_notes')
      .insert({
        tenant_id: data.tenantId,
        venue_id: data.venueId,
        supplier_id: data.supplierId,
        purchase_order_id: data.purchaseOrderId ?? null,
        reference: data.reference,
        received_on: data.receivedOn,
        notes: data.notes,
      })
      .select('id')
      .single()
    if (error || !note) throw new Error(`delivery_note_create_failed:${error?.code ?? 'unknown'}`)
    const { error: linesError } = await supabase.from('delivery_note_lines').insert(
      data.lines.map((line) => ({
        delivery_note_id: note.id,
        ingredient_id: line.ingredientId,
        quantity: line.quantity,
        unit_cost_cents: line.unitCostCents,
        tenant_id: data.tenantId,
      })),
    )
    if (linesError) throw new Error(`delivery_note_lines_create_failed:${linesError.code}`)
    return { deliveryNoteId: note.id as string }
  })

export const receiveDeliveryNote = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(receiveDeliveryNoteInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).rpc(
      'receive_delivery_note',
      { p_delivery_note_id: data.deliveryNoteId },
    )
    if (error) throw new Error(`delivery_note_receive_failed:${error.code}`)
    return { ok: true }
  })

export const createPurchaseOrder = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(purchaseOrderInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const invalid = validatePurchaseOrderLines(data.lines)
    if (invalid) throw new Error(invalid)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: order, error } = await supabase
      .from('purchase_orders')
      .insert({
        tenant_id: data.tenantId,
        venue_id: data.venueId,
        supplier_id: data.supplierId,
        notes: data.notes,
        created_by: context.tenantMembership.userId,
      })
      .select('id')
      .single()
    if (error || !order) throw new Error(`purchase_order_create_failed:${error?.code ?? 'unknown'}`)
    const { error: linesError } = await supabase.from('purchase_order_lines').insert(
      data.lines.map((line) => ({
        tenant_id: data.tenantId,
        purchase_order_id: order.id,
        ingredient_id: line.ingredientId,
        quantity: line.quantity,
        unit_cost_cents: line.unitCostCents,
      })),
    )
    if (linesError) throw new Error(`purchase_order_lines_create_failed:${linesError.code}`)
    return { purchaseOrderId: order.id as string }
  })

export const listPurchaseOrders = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(purchaseOrderListInput)
  .handler(
    async ({
      context,
      data,
    }): Promise<
      PaginatedResult<{
        id: string
        supplierId: string
        status: string
        notes: string
        createdAt: string
        lines: { ingredientId: string; quantity: number; unitCostCents: number }[]
      }>
    > => {
      const {
        data: rows,
        error,
        count,
      } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
        .from('purchase_orders')
        .select(
          'id, supplier_id, status, notes, created_at, purchase_order_lines(ingredient_id, quantity, unit_cost_cents)',
          { count: 'exact' },
        )
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .order('created_at', { ascending: false })
        .range(...(Object.values(paginationRange(data)) as [number, number]))
      if (error) throw new Error(`purchase_orders_load_failed:${error.code}`)
      const items = (rows ?? []).map((row) => ({
        id: row.id as string,
        supplierId: row.supplier_id as string,
        status: row.status as string,
        notes: row.notes as string,
        createdAt: row.created_at as string,
        lines: (
          row.purchase_order_lines as Array<{
            ingredient_id: string
            quantity: number
            unit_cost_cents: number
          }>
        ).map((line) => ({
          ingredientId: line.ingredient_id,
          quantity: Number(line.quantity),
          unitCostCents: Number(line.unit_cost_cents),
        })),
      }))
      const total = count ?? 0
      return {
        items,
        page: data.page,
        pageSize: data.pageSize,
        total,
        hasMore: data.page * data.pageSize < total,
      }
    },
  )

export const updatePurchaseOrderStatus = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(purchaseOrderStatusInput)
  .handler(async ({ context, data }) => {
    requireProductEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: order, error } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', data.purchaseOrderId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (error || !order) throw new Error('purchase_order_not_found')
    if (
      !canAdvancePurchaseOrder(
        order.status as Parameters<typeof canAdvancePurchaseOrder>[0],
        data.status,
      )
    )
      throw new Error('purchase_order_invalid_transition')
    const update =
      data.status === 'approved'
        ? {
            status: data.status,
            approved_by: context.tenantMembership.userId,
            approved_at: new Date().toISOString(),
          }
        : { status: data.status }
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update(update)
      .eq('id', data.purchaseOrderId)
      .eq('tenant_id', data.tenantId)
    if (updateError) throw new Error(`purchase_order_status_failed:${updateError.code}`)
    return { ok: true }
  })
