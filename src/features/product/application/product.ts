import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { operationalTenantMiddleware, tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'
import { createIngredientInput, inventoryMovementInput, inventoryQueryInput, productTenantInput, recipeInput, recipeQueryInput, recipeVersionsInput, restoreRecipeVersionInput, requireProductEditor } from './product-schema'
import { calculateStock, findLowStock } from '../domain/inventory'
import { calculateRecipeCost } from '../domain/product-costing'

const middleware = [authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware] as const

export const listIngredients = createServerFn({ method: 'GET' }).middleware(middleware).validator(productTenantInput).handler(async ({ context, data }) => {
  requireProductEditor(context.tenantMembership.role)
  const { data: rows, error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).from('ingredients').select('id, name, unit, cost_cents_per_unit, allergens, is_vegan, is_active, minimum_stock').eq('tenant_id', data.tenantId).order('name')
  if (error) throw new Error(`ingredients_load_failed:${error.code}`)
  return (rows ?? []).map((row) => ({ id: row.id as string, name: row.name as string, unit: row.unit as string, costCentsPerUnit: Number(row.cost_cents_per_unit), allergens: (row.allergens as string[]) ?? [], isVegan: Boolean(row.is_vegan), isActive: Boolean(row.is_active), minimumStock: Number(row.minimum_stock ?? 0) }))
})

export const createIngredient = createServerFn({ method: 'POST' }).middleware(middleware).validator(createIngredientInput).handler(async ({ context, data }) => {
  requireProductEditor(context.tenantMembership.role)
  const { data: row, error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).from('ingredients').insert({ tenant_id: data.tenantId, name: data.name, unit: data.unit, cost_cents_per_unit: data.costCentsPerUnit, allergens: data.allergens, is_vegan: data.isVegan, minimum_stock: data.minimumStock }).select('id').single()
  if (error || !row) throw new Error(`ingredient_create_failed:${error?.code ?? 'unknown'}`)
  return { ingredientId: row.id as string }
})

export const replaceRecipe = createServerFn({ method: 'POST' }).middleware(middleware).validator(recipeInput).handler(async ({ context, data }) => {
  requireProductEditor(context.tenantMembership.role)
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const { data: menuItem, error: menuError } = await supabase.from('menu_items').select('id').eq('id', data.menuItemId).eq('tenant_id', data.tenantId).single()
  if (menuError || !menuItem) throw new Response('Not found', { status: 404 })
  const { data: previousLines, error: previousError } = await supabase.from('recipe_ingredients').select('ingredient_id, quantity, waste_percent').eq('tenant_id', data.tenantId).eq('menu_item_id', data.menuItemId)
  if (previousError && previousError.code !== '42P01') throw new Error(`recipe_previous_load_failed:${previousError.code}`)
  if (previousLines?.length) {
    const { data: latest } = await supabase.from('recipe_versions').select('version').eq('tenant_id', data.tenantId).eq('menu_item_id', data.menuItemId).order('version', { ascending: false }).limit(1).maybeSingle()
    const { error: versionError } = await supabase.from('recipe_versions').insert({ tenant_id: data.tenantId, menu_item_id: data.menuItemId, version: Number(latest?.version ?? 0) + 1, lines: previousLines, created_by: context.tenantMembership.userId })
    if (versionError) throw new Error(`recipe_version_create_failed:${versionError.code}`)
  }
  const { error: deleteError } = await supabase.from('recipe_ingredients').delete().eq('menu_item_id', data.menuItemId).eq('tenant_id', data.tenantId)
  if (deleteError) throw new Error(`recipe_replace_failed:${deleteError.code}`)
  if (data.lines.length) {
    const { error } = await supabase.from('recipe_ingredients').insert(data.lines.map((line) => ({ tenant_id: data.tenantId, menu_item_id: data.menuItemId, ingredient_id: line.ingredientId, quantity: line.quantity, waste_percent: line.wastePercent })))
    if (error) throw new Error(`recipe_lines_create_failed:${error.code}`)
  }
  return { menuItemId: data.menuItemId, lineCount: data.lines.length }
})

export const getRecipeCost = createServerFn({ method: 'GET' }).middleware(middleware).validator(recipeQueryInput).handler(async ({ context, data }) => {
  requireProductEditor(context.tenantMembership.role)
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const { data: rows, error } = await supabase.from('recipe_ingredients').select('quantity, waste_percent, ingredients!inner(name, cost_cents_per_unit, allergens, is_vegan)').eq('tenant_id', data.tenantId).eq('menu_item_id', data.menuItemId)
  if (error) throw new Error(`recipe_cost_load_failed:${error.code}`)
  return calculateRecipeCost((rows ?? []).map((row) => { const ingredient = (row.ingredients as { name: string; cost_cents_per_unit: number; allergens: string[]; is_vegan: boolean }[])[0]; return { name: ingredient?.name ?? 'Ingrediente', quantity: Number(row.quantity), costCentsPerUnit: Number(ingredient?.cost_cents_per_unit ?? 0), wastePercent: Number(row.waste_percent), allergens: ingredient?.allergens ?? [], isVegan: Boolean(ingredient?.is_vegan) } }))
})

export const listRecipeVersions = createServerFn({ method: 'GET' }).middleware(middleware).validator(recipeVersionsInput).handler(async ({ context, data }) => {
  requireProductEditor(context.tenantMembership.role)
  const { data: rows, error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).from('recipe_versions').select('id, version, lines, created_at').eq('tenant_id', data.tenantId).eq('menu_item_id', data.menuItemId).order('version', { ascending: false })
  if (error) throw new Error(`recipe_versions_load_failed:${error.code}`)
  return rows ?? []
})

export const restoreRecipeVersion = createServerFn({ method: 'POST' }).middleware(middleware).validator(restoreRecipeVersionInput).handler(async ({ context, data }) => {
  requireProductEditor(context.tenantMembership.role)
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const { data: version, error: versionError } = await supabase.from('recipe_versions').select('lines').eq('tenant_id', data.tenantId).eq('menu_item_id', data.menuItemId).eq('version', data.version).single()
  if (versionError || !version) throw new Response('Recipe version not found', { status: 404 })
  const lines = (version.lines as { ingredient_id: string; quantity: number; waste_percent: number }[]).map((line) => ({ ingredientId: line.ingredient_id, quantity: Number(line.quantity), wastePercent: Number(line.waste_percent ?? 0) }))
  const current = await supabase.from('recipe_ingredients').select('ingredient_id, quantity, waste_percent').eq('tenant_id', data.tenantId).eq('menu_item_id', data.menuItemId)
  if (current.error) throw new Error(`recipe_current_load_failed:${current.error.code}`)
  if (current.data?.length) {
    const latest = await supabase.from('recipe_versions').select('version').eq('tenant_id', data.tenantId).eq('menu_item_id', data.menuItemId).order('version', { ascending: false }).limit(1).maybeSingle()
    const { error } = await supabase.from('recipe_versions').insert({ tenant_id: data.tenantId, menu_item_id: data.menuItemId, version: Number(latest.data?.version ?? 0) + 1, lines: current.data, created_by: context.tenantMembership.userId })
    if (error) throw new Error(`recipe_version_create_failed:${error.code}`)
  }
  await supabase.from('recipe_ingredients').delete().eq('tenant_id', data.tenantId).eq('menu_item_id', data.menuItemId)
  if (lines.length) {
    const { error } = await supabase.from('recipe_ingredients').insert(lines.map((line) => ({ tenant_id: data.tenantId, menu_item_id: data.menuItemId, ingredient_id: line.ingredientId, quantity: line.quantity, waste_percent: line.wastePercent })))
    if (error) throw new Error(`recipe_restore_failed:${error.code}`)
  }
  return { menuItemId: data.menuItemId, restoredVersion: data.version }
})

export const getInventory = createServerFn({ method: 'GET' }).middleware(middleware).validator(inventoryQueryInput).handler(async ({ context, data }) => {
  requireProductEditor(context.tenantMembership.role)
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const { data: movements, error } = await supabase.from('inventory_movements').select('ingredient_id, quantity').eq('tenant_id', data.tenantId).eq('venue_id', data.venueId).order('created_at')
  if (error) throw new Error(`inventory_load_failed:${error.code}`)
  const stock = calculateStock((movements ?? []).map((movement) => ({ ingredientId: movement.ingredient_id as string, quantity: Number(movement.quantity) })))
  const ingredients = await supabase.from('ingredients').select('id, minimum_stock').eq('tenant_id', data.tenantId).eq('is_active', true)
  if (ingredients.error) throw new Error(`inventory_minimums_load_failed:${ingredients.error.code}`)
  return { stock, lowStockIngredientIds: findLowStock(stock, (ingredients.data ?? []).map((row) => ({ ingredientId: row.id as string, minimum: Number(row.minimum_stock ?? 0) }))) }
})

export const addInventoryMovement = createServerFn({ method: 'POST' }).middleware(middleware).validator(inventoryMovementInput).handler(async ({ context, data }) => {
  requireProductEditor(context.tenantMembership.role)
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const { data: row, error } = await supabase.from('inventory_movements').insert({ tenant_id: data.tenantId, venue_id: data.venueId, ingredient_id: data.ingredientId, kind: data.kind, quantity: data.quantity, unit_cost_cents: data.unitCostCents ?? null, reason: data.reason, created_by: context.tenantMembership.userId }).select('id').single()
  if (error || !row) throw new Error(`inventory_movement_failed:${error?.code ?? 'unknown'}`)
  return { movementId: row.id as string }
})
