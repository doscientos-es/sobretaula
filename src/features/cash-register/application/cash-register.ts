import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  addCashMovementInput,
  closeCashRegisterInput,
  openCashRegisterInput,
  venueCashInput,
} from './cash-register-schema'

function requireManager(role: string) {
  if (!['owner', 'manager'].includes(role)) throw new Response('Forbidden', { status: 403 })
}
const secured = [authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware] as const

export const getCashRegister = createServerFn({ method: 'GET' })
  .middleware(secured)
  .validator(venueCashInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: register, error } = await supabase
      .from('cash_registers')
      .select('id, opened_at, opening_float_cents, status')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .eq('status', 'open')
      .maybeSingle()
    if (error) throw new Error(`cash_register_load_failed:${error.code}`)
    if (!register) return null
    const [movements, sales] = await Promise.all([
      supabase
        .from('cash_movements')
        .select('amount_cents, kind')
        .eq('tenant_id', data.tenantId)
        .eq('register_id', register.id),
      supabase
        .from('payments')
        .select('amount_cents, method')
        .eq('tenant_id', data.tenantId)
        .gte('paid_at', register.opened_at),
    ])
    if (movements.error || sales.error) throw new Error('cash_register_totals_failed')
    const byMethod: Record<string, number> = {}
    for (const row of sales.data ?? [])
      byMethod[row.method as string] =
        (byMethod[row.method as string] ?? 0) + (row.amount_cents as number)
    return {
      ...register,
      movements: movements.data ?? [],
      cashSalesCents: byMethod.cash ?? 0,
      salesByMethod: byMethod,
    }
  })

export const listClosedCashRegisters = createServerFn({ method: 'GET' })
  .middleware(secured)
  .validator(venueCashInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const { data: rows, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('cash_registers')
      .select(
        'id, opened_at, closed_at, opening_float_cents, counted_cash_cents, sales_by_method, status',
      )
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(`cash_register_history_failed:${error.code}`)
    return rows ?? []
  })

export const openCashRegister = createServerFn({ method: 'POST' })
  .middleware(secured)
  .validator(openCashRegisterInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: register, error } = await supabase
      .from('cash_registers')
      .insert({
        tenant_id: data.tenantId,
        venue_id: data.venueId,
        opened_by: context.tenantMembership.userId,
        opening_float_cents: data.openingFloatCents,
      })
      .select('id')
      .single()
    if (error || !register)
      throw new Response(
        error?.code === '23505' ? 'Cash register already open' : 'Unable to open cash register',
        { status: error?.code === '23505' ? 409 : 500 },
      )
    return { registerId: register.id as string }
  })

export const addCashMovement = createServerFn({ method: 'POST' })
  .middleware(secured)
  .validator(addCashMovementInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { error } = await supabase
      .from('cash_movements')
      .insert({
        tenant_id: data.tenantId,
        register_id: data.registerId,
        kind: data.kind,
        amount_cents: data.amountCents,
        reason: data.reason,
        created_by: context.tenantMembership.userId,
      })
    if (error) throw new Error(`cash_movement_failed:${error.code}`)
    return { registerId: data.registerId }
  })

export const closeCashRegister = createServerFn({ method: 'POST' })
  .middleware(secured)
  .validator(closeCashRegisterInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: openRegister, error: loadError } = await supabase
      .from('cash_registers')
      .select('opened_at')
      .eq('id', data.registerId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .eq('status', 'open')
      .single()
    if (loadError || !openRegister)
      throw new Response('Cash register not found or already closed', { status: 409 })
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('method, amount_cents')
      .eq('tenant_id', data.tenantId)
      .gte('paid_at', openRegister.opened_at)
    if (paymentsError) throw new Error(`cash_close_payments_failed:${paymentsError.code}`)
    const salesByMethod: Record<string, number> = {}
    for (const payment of payments ?? [])
      salesByMethod[payment.method as string] =
        (salesByMethod[payment.method as string] ?? 0) + (payment.amount_cents as number)
    const { data: register, error } = await supabase
      .from('cash_registers')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: context.tenantMembership.userId,
        counted_cash_cents: data.countedCashCents,
        sales_by_method: salesByMethod,
      })
      .eq('id', data.registerId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .eq('status', 'open')
      .select('id')
      .single()
    if (error || !register)
      throw new Response('Cash register not found or already closed', { status: 409 })
    return { registerId: register.id as string, countedCashCents: data.countedCashCents }
  })
