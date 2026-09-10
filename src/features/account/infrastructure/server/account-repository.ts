import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  AccountLine,
  AccountPayment,
  KitchenStation,
  OrderItemStatus,
  PaymentMethod,
} from '../../domain/account'

export interface AccountQuery {
  sessionId: string
  tenantId: string
  venueId: string
}

export interface AccountSessionInfo {
  covers: number
  id: string
  openedAt: string
  status: string
  tableCodes: string[]
  discountCents: number
}

export interface AccountData {
  lines: AccountLine[]
  payments: AccountPayment[]
  session: AccountSessionInfo
}

/**
 * Everything the account view needs: the session with its table codes, all
 * order lines and all payments. Returns null when the session is not of this
 * venue (or does not exist at all).
 */
export async function loadAccount(
  supabase: SupabaseClient,
  { sessionId, tenantId, venueId }: AccountQuery,
): Promise<AccountData | null> {
  const { data: session, error: sessionError } = await supabase
    .from('table_sessions')
    .select('covers, discount_cents, id, opened_at, status, table_ids')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .eq('venue_id', venueId)
    .single()
  if (sessionError || !session) return null

  const tableIds = (session.table_ids as string[]) ?? []
  const [tablesResult, ordersResult, paymentsResult] = await Promise.all([
    tableIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('tables').select('code, id').eq('tenant_id', tenantId).in('id', tableIds),
    supabase
      .from('orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId)
      .order('created_at'),
    supabase
      .from('payments')
      .select('amount_cents, id, method, paid_at, tip_cents')
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId)
      .order('paid_at'),
  ])
  if (tablesResult.error || ordersResult.error || paymentsResult.error) {
    throw new Error('account_load_failed')
  }

  const orderIds = (ordersResult.data ?? []).map((order) => order.id as string)
  const paymentIds = (paymentsResult.data ?? []).map((payment) => payment.id as string)
  const refundsResult = paymentIds.length
    ? await supabase.from('payment_refunds').select('amount_cents, payment_id').eq('tenant_id', tenantId).in('payment_id', paymentIds)
    : { data: [], error: null }
  if (refundsResult.error && refundsResult.error.code !== '42P01') throw new Error('account_refunds_load_failed')
  const refundedByPayment = new Map<string, number>()
  for (const refund of refundsResult.data ?? []) refundedByPayment.set(refund.payment_id as string, (refundedByPayment.get(refund.payment_id as string) ?? 0) + (refund.amount_cents as number))
  let itemsResult = await (orderIds.length === 0
    ? Promise.resolve({ data: [], error: null })
    : supabase
        .from('order_items')
        .select(
          'id, kitchen_station, name_snapshot, notes, preparation_minutes, quantity, status, unit_price_cents, vat_rate_bps',
        )
        .eq('tenant_id', tenantId)
        .in('order_id', orderIds)
        .order('created_at'))
  if (itemsResult.error?.code === '42703' && orderIds.length > 0) {
    const legacy = await supabase
      .from('order_items')
      .select('id, name_snapshot, notes, quantity, unit_price_cents, vat_rate_bps')
      .eq('tenant_id', tenantId)
      .in('order_id', orderIds)
      .order('created_at')
    itemsResult = {
      ...legacy,
      data: (legacy.data ?? []).map((item) => ({
        ...item,
        kitchen_station: 'general',
        preparation_minutes: 15,
        status: 'pending',
      })),
    } as typeof itemsResult
  }
  if (itemsResult.error) throw new Error('account_load_failed')

  const tableCodes = new Map<string, string>(
    (tablesResult.data ?? []).map((table) => [table.id as string, table.code as string]),
  )

  return {
    lines: (itemsResult.data ?? []).map((item) => ({
      id: item.id as string,
      status: (item.status as OrderItemStatus | null) ?? 'pending',
      kitchenStation: item.kitchen_station as KitchenStation,
      name: item.name_snapshot as string,
      notes: (item.notes as string | null) ?? null,
      preparationMinutes: item.preparation_minutes as number,
      quantity: item.quantity as number,
      unitPriceCents: item.unit_price_cents as number,
      vatRateBps: item.vat_rate_bps as number,
    })),
    payments: (paymentsResult.data ?? []).map((payment) => ({
      amountCents: payment.amount_cents as number,
      id: payment.id as string,
      method: payment.method as PaymentMethod,
      paidAt: payment.paid_at as string,
      tipCents: payment.tip_cents as number,
      refundedCents: refundedByPayment.get(payment.id as string) ?? 0,
    })),
    session: {
      covers: session.covers as number,
      discountCents: (session.discount_cents as number | null) ?? 0,
      id: session.id as string,
      openedAt: session.opened_at as string,
      status: session.status as string,
      tableCodes: tableIds
        .map((tableId) => tableCodes.get(tableId))
        .filter((code): code is string => typeof code === 'string'),
    },
  }
}
