import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { localizedText } from '@/shared/lib/i18n/localized-text'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { computeAccountTotals, type AccountTotals } from '../domain/account'
import {
  loadAccount,
  type AccountData,
  type AccountQuery,
} from '../infrastructure/server/account-repository'
import {
  accountSessionInput,
  addOrderItemInput,
  recordPaymentInput,
  refundPaymentInput,
  applyDiscountInput,
  removeOrderItemInput,
  requireAccountEditor,
  updateOrderItemStatusInput,
} from './account-schema'

export interface AccountView extends AccountData {
  totals: AccountTotals
}

/** The session must exist in this venue and still be open for mutation. */
async function requireOpenSession(
  supabase: SupabaseClient,
  { sessionId, tenantId, venueId }: AccountQuery,
): Promise<string> {
  const { data, error } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .eq('venue_id', venueId)
    .eq('status', 'open')
    .single()
  if (error || !data) throw new Response('Not found', { status: 404 })
  return data.id as string
}

/** Account of one open table session: lines, payments and computed totals. */
export const getAccount = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(accountSessionInput)
  .handler(async ({ context, data }): Promise<AccountView> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const account = await loadAccount(supabase, data)
    if (!account) throw new Response('Not found', { status: 404 })
    return { ...account, totals: computeAccountTotals(account.lines, account.payments, account.session.discountCents) }
  })

/** Adds a line with the catalog price and VAT frozen at this very moment. */
export const addOrderItem = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(addOrderItemInput)
  .handler(async ({ context, data }) => {
    requireAccountEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const sessionId = await requireOpenSession(supabase, data)

    let menuResult = await supabase
      .from('menu_items')
      .select('id, kitchen_station, name_i18n, preparation_minutes, price_cents, vat_rate_bps')
      .eq('id', data.menuItemId)
      .eq('tenant_id', data.tenantId)
      .eq('is_active', true)
      .single()
    if (menuResult.error?.code === '42703') {
      const legacy = await supabase
        .from('menu_items')
        .select('id, name_i18n, price_cents, vat_rate_bps')
        .eq('id', data.menuItemId)
        .eq('tenant_id', data.tenantId)
        .eq('is_active', true)
        .single()
      menuResult = {
        ...legacy,
        data: legacy.data
          ? { ...legacy.data, kitchen_station: 'general', preparation_minutes: 15 }
          : null,
      } as typeof menuResult
    }
    const { data: menuItem, error: menuError } = menuResult
    if (menuError || !menuItem) throw new Response('Not found', { status: 404 })

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        created_by: context.tenantMembership.userId,
        session_id: sessionId,
        tenant_id: data.tenantId,
      })
      .select('id')
      .single()
    if (orderError || !order)
      throw new Error(`account_order_create_failed:${orderError?.code ?? 'unknown'}`)

    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .insert({
        menu_item_id: menuItem.id,
        kitchen_station: menuItem.kitchen_station ?? 'general',
        preparation_minutes: menuItem.preparation_minutes ?? 15,
        name_snapshot: localizedText(menuItem.name_i18n as Record<string, string>, 'es'),
        notes: data.notes ?? null,
        order_id: order.id,
        status: 'pending',
        quantity: data.quantity,
        tenant_id: data.tenantId,
        unit_price_cents: menuItem.price_cents,
        vat_rate_bps: menuItem.vat_rate_bps,
      })
      .select('id')
      .single()
    if (itemError || !item) {
      await supabase.from('orders').delete().eq('id', order.id)
      throw new Error(`account_item_add_failed:${itemError?.code ?? 'unknown'}`)
    }
    // Descuenta ingredientes de forma auditable cuando el producto tiene receta.
    const recipeResult = await supabase
      .from('recipe_ingredients')
      .select('ingredient_id, quantity, waste_percent')
      .eq('tenant_id', data.tenantId)
      .eq('menu_item_id', menuItem.id as string)
    if (recipeResult.error && recipeResult.error.code !== '42P01') {
      await supabase.from('order_items').delete().eq('id', item.id as string)
      await supabase.from('orders').delete().eq('id', order.id)
      throw new Error(`recipe_load_failed:${recipeResult.error.code}`)
    }
    const recipeLines = recipeResult.data ?? []
    if (recipeLines.length > 0) {
      const { error: inventoryError } = await supabase.from('inventory_movements').insert(
        recipeLines.map((line) => ({
          tenant_id: data.tenantId,
          venue_id: data.venueId,
          ingredient_id: line.ingredient_id,
          kind: 'sale',
          quantity:
            -Number(line.quantity) * data.quantity * (1 + Number(line.waste_percent ?? 0) / 100),
          reason: `Consumo de comanda ${order.id}`,
          created_by: context.tenantMembership.userId,
        })),
      )
      if (inventoryError) {
        await supabase.from('order_items').delete().eq('id', item.id as string)
        await supabase.from('orders').delete().eq('id', order.id)
        throw new Error(`inventory_sale_failed:${inventoryError.code}`)
      }
    }
    return { orderItemId: item.id as string }
  })

/** Cocina/sala actualizan el ciclo de vida de una línea, sin alterar su precio. */
export const updateOrderItemStatus = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(updateOrderItemStatusInput)
  .handler(async ({ context, data }) => {
    requireAccountEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const sessionId = await requireOpenSession(supabase, data)
    const { data: item, error: lookupError } = await supabase
      .from('order_items')
      .select('id, status, orders!inner(session_id)')
      .eq('id', data.orderItemId)
      .eq('tenant_id', data.tenantId)
      .eq('orders.session_id', sessionId)
      .single()
    if (lookupError || !item) throw new Response('Not found', { status: 404 })
    const { error } = await supabase
      .from('order_items')
      .update({ status: data.status })
      .eq('id', item.id as string)
      .eq('tenant_id', data.tenantId)
    if (error) throw new Error(`account_item_status_update_failed:${error.code}`)
    return { orderItemId: data.orderItemId, status: data.status }
  })

/** Lines can only leave the account while nothing has been charged yet. */
export const removeOrderItem = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(removeOrderItemInput)
  .handler(async ({ context, data }) => {
    requireAccountEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const sessionId = await requireOpenSession(supabase, data)

    const { count: paymentCount, error: paymentError } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', data.tenantId)
      .eq('session_id', sessionId)
    if (paymentError) throw new Error(`account_payments_check_failed:${paymentError.code}`)
    if ((paymentCount ?? 0) > 0) throw new Response('Payments recorded', { status: 409 })

    const { data: itemRow, error: itemLookupError } = await supabase
      .from('order_items')
      .select('id, order_id, menu_item_id, quantity')
      .eq('id', data.orderItemId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (itemLookupError || !itemRow) throw new Response('Not found', { status: 404 })

    if (itemRow.menu_item_id) {
      const { data: recipeLines, error: recipeError } = await supabase
        .from('recipe_ingredients')
        .select('ingredient_id, quantity, waste_percent')
        .eq('tenant_id', data.tenantId)
        .eq('menu_item_id', itemRow.menu_item_id as string)
      if (recipeError && recipeError.code !== '42P01')
        throw new Error(`recipe_load_failed:${recipeError.code}`)
      if (recipeLines?.length) {
        const { error: restoreError } = await supabase.from('inventory_movements').insert(
          recipeLines.map((line) => ({
            tenant_id: data.tenantId,
            venue_id: data.venueId,
            ingredient_id: line.ingredient_id,
            kind: 'adjustment',
            quantity:
              Number(line.quantity) * Number(itemRow.quantity) *
              (1 + Number(line.waste_percent ?? 0) / 100),
            reason: `Reversión de comanda ${itemRow.order_id}`,
            created_by: context.tenantMembership.userId,
          })),
        )
        if (restoreError) throw new Error(`inventory_restore_failed:${restoreError.code}`)
      }
    }

    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('id', itemRow.id as string)
    if (deleteError) throw new Error(`account_item_remove_failed:${deleteError.code}`)

    // Si la comanda se queda sin líneas, desaparece con ellas.
    const { count: remaining } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', itemRow.order_id as string)
    if ((remaining ?? 0) === 0) {
      await supabase
        .from('orders')
        .delete()
        .eq('id', itemRow.order_id as string)
        .eq('tenant_id', data.tenantId)
    }
    return { orderItemId: data.orderItemId }
  })

/** Charges money against the session; never more than what is left to pay. */
export const recordPayment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(recordPaymentInput)
  .handler(async ({ context, data }) => {
    requireAccountEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const sessionId = await requireOpenSession(supabase, data)

    const account = await loadAccount(supabase, data)
    if (!account) throw new Response('Not found', { status: 404 })
    const { balanceCents } = computeAccountTotals(account.lines, account.payments, account.session.discountCents)
    if (data.amountCents > balanceCents)
      throw new Response('Payment exceeds balance', { status: 422 })

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        amount_cents: data.amountCents,
        created_by: context.tenantMembership.userId,
        method: data.method,
        session_id: sessionId,
        tip_cents: data.tipCents ?? 0,
        tenant_id: data.tenantId,
      })
      .select('id')
      .single()
    if (error || !payment) throw new Error(`account_payment_failed:${error?.code ?? 'unknown'}`)
    return { balanceCents: balanceCents - data.amountCents, paymentId: payment.id as string }
  })

export const refundPayment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(refundPaymentInput)
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role)) throw new Response('Forbidden', { status: 403 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: payment, error: paymentError } = await supabase.from('payments').select('amount_cents').eq('id', data.paymentId).eq('tenant_id', data.tenantId).eq('session_id', data.sessionId).single()
    if (paymentError || !payment) throw new Response('Not found', { status: 404 })
    const { data: refunds, error: refundLoadError } = await supabase.from('payment_refunds').select('amount_cents').eq('tenant_id', data.tenantId).eq('payment_id', data.paymentId)
    if (refundLoadError) throw new Error(`refunds_load_failed:${refundLoadError.code}`)
    const alreadyRefunded = (refunds ?? []).reduce((sum, refund) => sum + (refund.amount_cents as number), 0)
    if (alreadyRefunded + data.amountCents > (payment.amount_cents as number)) throw new Response('Refund exceeds payment', { status: 422 })
    const { data: refund, error } = await supabase.from('payment_refunds').insert({ amount_cents: data.amountCents, created_by: context.tenantMembership.userId, payment_id: data.paymentId, reason: data.reason, tenant_id: data.tenantId }).select('id').single()
    if (error || !refund) throw new Error(`refund_create_failed:${error?.code ?? 'unknown'}`)
    return { refundId: refund.id as string, refundedCents: alreadyRefunded + data.amountCents }
  })

export const applyDiscount = createServerFn({ method: 'POST' }).middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware]).validator(applyDiscountInput).handler(async ({ context, data }) => {
  if (!['owner', 'manager'].includes(context.tenantMembership.role)) throw new Response('Forbidden', { status: 403 })
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const account = await loadAccount(supabase, data)
  if (!account) throw new Response('Not found', { status: 404 })
  const totals = computeAccountTotals(account.lines, account.payments, account.session.discountCents)
  if (data.discountCents > totals.grossCents) throw new Response('Discount exceeds account', { status: 422 })
  const { error: auditError } = await supabase.from('session_discount_audits').insert({ tenant_id: data.tenantId, session_id: data.sessionId, discount_cents: data.discountCents, reason: data.reason, created_by: context.tenantMembership.userId })
  if (auditError) throw new Error(`discount_audit_failed:${auditError.code}`)
  const { error } = await supabase.from('table_sessions').update({ discount_cents: data.discountCents }).eq('id', data.sessionId).eq('tenant_id', data.tenantId).eq('venue_id', data.venueId).eq('status', 'open')
  if (error) throw new Error(`discount_update_failed:${error.code}`)
  return { discountCents: data.discountCents }
})
