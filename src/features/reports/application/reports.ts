import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { calculateLaborCosts, workedMinutes, type TimeEventType } from '@/features/timekeeping'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { calculateProfitability } from '../domain/profitability'
import { aggregateSales, summarizeProducts } from '../domain/sales-report'
import { salesReportInput } from './reports-schema'
export const getSalesReport = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(salesReportInput)
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: sessions, error: sessionError } = await supabase
      .from('table_sessions')
      .select('id, discount_cents')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (sessionError) throw new Error(`sales_sessions_failed:${sessionError.code}`)
    const sessionIds = (sessions ?? []).map((session) => session.id as string)
    const discountsCents = (sessions ?? []).reduce(
      (sum, session) => sum + Number(session.discount_cents ?? 0),
      0,
    )
    if (!sessionIds.length) {
      const [closedRegisters, reconciliations] = await Promise.all([
        supabase
          .from('cash_registers')
          .select('id, opened_at, closed_at, counted_cash_cents, sales_by_method, status')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .eq('status', 'closed')
          .gte('closed_at', data.from)
          .lt('closed_at', data.to),
        supabase
          .from('cash_reconciliations')
          .select(
            'id, register_id, expected_cash_cents, counted_cash_cents, variance_cents, note, reconciled_at',
          )
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .gte('reconciled_at', data.from)
          .lt('reconciled_at', data.to),
      ])
      if (closedRegisters.error || reconciliations.error)
        throw new Error('sales_financial_history_failed')
      return {
        grossCents: 0,
        byMethod: {},
        vatCents: 0,
        ticketAverageCents: 0,
        netCollectedCents: 0,
        refundedCents: 0,
        discountsCents: 0,
        products: [],
        productSummary: [],
        financial: {
          closedRegisters: closedRegisters.data ?? [],
          mixedPaymentBatches: 0,
          reconciliations: reconciliations.data ?? [],
          totalTipsCents: 0,
        },
        profitability: calculateProfitability({
          grossCents: 0,
          refundedCents: 0,
          discountsCents: 0,
          foodCostCents: 0,
          wasteCostCents: 0,
          laborCostCents: 0,
          laborCostAvailable: false,
          wasteMovements: 0,
          dataFrom: data.from,
          dataTo: data.to,
        }),
      }
    }
    const [payments, orders, closedRegisters, reconciliations, inventory, laborEvents, laborRates] =
      await Promise.all([
        supabase
          .from('payments')
          .select('batch_id, id, method, amount_cents, tip_cents')
          .eq('tenant_id', data.tenantId)
          .in('session_id', sessionIds)
          .gte('paid_at', data.from)
          .lt('paid_at', data.to),
        supabase
          .from('orders')
          .select('id')
          .eq('tenant_id', data.tenantId)
          .in('session_id', sessionIds),
        supabase
          .from('cash_registers')
          .select('id, opened_at, closed_at, counted_cash_cents, sales_by_method, status')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .eq('status', 'closed')
          .gte('closed_at', data.from)
          .lt('closed_at', data.to)
          .order('closed_at', { ascending: false }),
        supabase
          .from('cash_reconciliations')
          .select(
            'id, register_id, expected_cash_cents, counted_cash_cents, variance_cents, note, reconciled_at',
          )
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .gte('reconciled_at', data.from)
          .lt('reconciled_at', data.to)
          .order('reconciled_at', { ascending: false }),
        supabase
          .from('inventory_movements')
          .select('kind, quantity, unit_cost_cents')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .gte('created_at', data.from)
          .lt('created_at', data.to)
          .in('kind', ['sale', 'waste']),
        supabase
          .from('timekeeping_events')
          .select('employee_id, event_type, occurred_at, client_occurred_at')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .gte('occurred_at', data.from)
          .lt('occurred_at', data.to)
          .order('occurred_at'),
        supabase
          .from('timekeeping_employee_rates')
          .select('employee_id, effective_from, hourly_cost_cents')
          .eq('tenant_id', data.tenantId)
          .lte('effective_from', data.to.slice(0, 10))
          .order('effective_from', { ascending: false }),
      ])
    if (
      payments.error ||
      orders.error ||
      closedRegisters.error ||
      reconciliations.error ||
      inventory.error ||
      laborEvents.error ||
      (laborRates.error && laborRates.error.code !== '42P01')
    )
      throw new Error('sales_report_load_failed')
    const orderIds = (orders.data ?? []).map((order) => order.id as string)
    const items = orderIds.length
      ? await supabase
          .from('order_items')
          .select('name_snapshot, quantity, unit_price_cents, vat_rate_bps')
          .eq('tenant_id', data.tenantId)
          .in('order_id', orderIds)
          .neq('status', 'cancelled')
      : { data: [], error: null }
    if (items.error) throw new Error(`sales_products_failed:${items.error.code}`)
    const paymentIds = (payments.data ?? []).map((payment) => payment.id as string)
    const refunds = paymentIds.length
      ? await supabase
          .from('payment_refunds')
          .select('amount_cents')
          .eq('tenant_id', data.tenantId)
          .in('payment_id', paymentIds)
      : { data: [], error: null }
    if (refunds.error && refunds.error.code !== '42P01')
      throw new Error(`sales_refunds_failed:${refunds.error.code}`)
    const refundedCents = (refunds.data ?? []).reduce(
      (sum, refund) => sum + (refund.amount_cents as number),
      0,
    )
    const aggregate = aggregateSales(
      (payments.data ?? []).map((row) => ({
        method: row.method as string,
        amountCents: row.amount_cents as number,
      })),
      (items.data ?? []).map((row) => ({
        name: row.name_snapshot as string,
        quantity: row.quantity as number,
        amountCents: (row.quantity as number) * (row.unit_price_cents as number),
        vatRateBps: row.vat_rate_bps as number,
      })),
      sessionIds.length,
    )
    const soldProducts = (items.data ?? []).map((row) => ({
      name: row.name_snapshot as string,
      quantity: row.quantity as number,
      amountCents: (row.quantity as number) * (row.unit_price_cents as number),
      vatRateBps: row.vat_rate_bps as number,
    }))
    const foodCostCents = (inventory.data ?? [])
      .filter((movement) => movement.kind === 'sale')
      .reduce(
        (sum, movement) =>
          sum +
          Math.round(Math.abs(Number(movement.quantity)) * Number(movement.unit_cost_cents ?? 0)),
        0,
      )
    const wasteRows = (inventory.data ?? []).filter((movement) => movement.kind === 'waste')
    const eventsByEmployee = new Map<
      string,
      Array<{ eventType: TimeEventType; occurredAt: string }>
    >()
    for (const event of laborEvents.data ?? []) {
      const employeeId = event.employee_id as string
      const events = eventsByEmployee.get(employeeId) ?? []
      events.push({
        eventType: event.event_type as TimeEventType,
        occurredAt: (event.client_occurred_at ?? event.occurred_at) as string,
      })
      eventsByEmployee.set(employeeId, events)
    }
    const labor = calculateLaborCosts(
      [...eventsByEmployee.entries()].map(([employeeId, events]) => ({
        employeeId,
        hourlyCostCents:
          laborRates.error?.code === '42P01'
            ? null
            : (((laborRates.data ?? []).find((rate) => rate.employee_id === employeeId)
                ?.hourly_cost_cents ?? null) as number | null),
        workedMinutes: workedMinutes(events, new Date(data.to)),
      })),
    )
    const profitability = calculateProfitability({
      grossCents: aggregate.grossCents,
      refundedCents,
      discountsCents,
      foodCostCents,
      wasteCostCents: wasteRows.reduce(
        (sum, movement) =>
          sum +
          Math.round(Math.abs(Number(movement.quantity)) * Number(movement.unit_cost_cents ?? 0)),
        0,
      ),
      laborCostCents: labor.totalCostCents,
      laborCostAvailable: labor.costAvailable,
      wasteMovements: wasteRows.length,
      dataFrom: data.from,
      dataTo: data.to,
    })
    return {
      ...aggregate,
      netCollectedCents: Math.max(0, aggregate.grossCents - refundedCents - discountsCents),
      refundedCents,
      discountsCents,
      products: items.data ?? [],
      productSummary: summarizeProducts(soldProducts),
      labor,
      profitability,
      financial: {
        closedRegisters: closedRegisters.data ?? [],
        mixedPaymentBatches: new Set(
          (payments.data ?? [])
            .map((payment) => payment.batch_id as string | null)
            .filter((batchId): batchId is string => Boolean(batchId)),
        ).size,
        reconciliations: reconciliations.data ?? [],
        totalTipsCents: (payments.data ?? []).reduce(
          (sum, payment) => sum + Number(payment.tip_cents ?? 0),
          0,
        ),
      },
    }
  })

export const exportSalesReportCsv = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(salesReportInput)
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: sessions, error } = await supabase
      .from('table_sessions')
      .select('id')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (error) throw new Error(`sales_export_sessions_failed:${error.code}`)
    const ids = (sessions ?? []).map((session) => session.id as string)
    const { data: orders } = ids.length
      ? await supabase
          .from('orders')
          .select('id')
          .eq('tenant_id', data.tenantId)
          .in('session_id', ids)
      : { data: [] }
    const orderIds = (orders ?? []).map((order) => order.id as string)
    const { data: items, error: itemsError } = orderIds.length
      ? await supabase
          .from('order_items')
          .select('name_snapshot, quantity, unit_price_cents, vat_rate_bps')
          .eq('tenant_id', data.tenantId)
          .in('order_id', orderIds)
          .neq('status', 'cancelled')
      : { data: [], error: null }
    if (itemsError) throw new Error(`sales_export_items_failed:${itemsError.code}`)
    const escape = (value: string | number | null) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`
    return [
      'producto,cantidad,total_cents,iva_bps',
      ...(items ?? []).map((item) =>
        [
          item.name_snapshot,
          item.quantity,
          (item.quantity as number) * (item.unit_price_cents as number),
          item.vat_rate_bps,
        ]
          .map(escape)
          .join(','),
      ),
    ].join('\n')
  })
