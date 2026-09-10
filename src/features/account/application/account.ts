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
  removeOrderItemInput,
  requireAccountEditor,
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
    return { ...account, totals: computeAccountTotals(account.lines, account.payments) }
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
    return { orderItemId: item.id as string }
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
      .select('id, order_id')
      .eq('id', data.orderItemId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (itemLookupError || !itemRow) throw new Response('Not found', { status: 404 })

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
    const { balanceCents } = computeAccountTotals(account.lines, account.payments)
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
