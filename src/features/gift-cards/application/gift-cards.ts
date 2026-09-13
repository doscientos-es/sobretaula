import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { paginationRange, type PaginatedResult } from '@/shared/lib/pagination'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { normalizeGiftCardCode } from '../domain/gift-card'
const middleware = [
  authMiddleware,
  tenantMembershipMiddleware,
  operationalTenantMiddleware,
] as const
const base = z.object({ tenantId: z.string().uuid() })
const listInput = base.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).default(''),
})
export interface GiftCard {
  id: string
  code: string
  initialBalanceCents: number
  balanceCents: number
  status: string
}
export const listGiftCards = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(listInput)
  .handler(async ({ context, data }): Promise<PaginatedResult<GiftCard>> => {
    const { from, to } = paginationRange({ page: data.page, pageSize: data.pageSize })
    let query = createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('gift_cards')
      .select('id, code, initial_balance_cents, balance_cents, status', { count: 'exact' })
      .eq('tenant_id', data.tenantId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
    if (data.search) query = query.ilike('code', `%${data.search}%`)
    const { data: cards, error, count } = await query
    if (error) throw new Error(`gift_cards_load_failed:${error.code}`)
    const items = (cards ?? []).map((card) => ({
      id: card.id,
      code: card.code,
      initialBalanceCents: Number(card.initial_balance_cents),
      balanceCents: Number(card.balance_cents),
      status: card.status,
    })) satisfies GiftCard[]
    const total = count ?? items.length
    return {
      items,
      page: data.page,
      pageSize: data.pageSize,
      total,
      hasMore: data.page * data.pageSize < total,
    }
  })
export const issueGiftCard = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(
    base.extend({
      code: z.string().trim().min(4).max(40),
      amountCents: z.number().int().positive().max(1000000),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('gift_cards')
      .insert({
        tenant_id: data.tenantId,
        code: normalizeGiftCardCode(data.code),
        initial_balance_cents: data.amountCents,
        balance_cents: data.amountCents,
        created_by: context.tenantMembership.userId,
      })
    if (error) throw new Error(`gift_card_issue_failed:${error.code}`)
    return { saved: true }
  })
export const redeemGiftCard = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(
    base.extend({
      code: z.string().min(4).max(40),
      amountCents: z.number().int().positive().max(1000000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).rpc(
      'redeem_gift_card',
      {
        p_tenant_id: data.tenantId,
        p_code: normalizeGiftCardCode(data.code),
        p_amount_cents: data.amountCents,
      },
    )
    if (error) throw new Error(`gift_card_redeem_failed:${error.code}`)
    return { saved: true }
  })

export const cancelGiftCard = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(base.extend({ cardId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const { data: cancelled, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('gift_cards')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', data.cardId)
      .eq('tenant_id', data.tenantId)
      .eq('status', 'active')
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`gift_card_cancel_failed:${error.code}`)
    if (!cancelled) throw new Error('gift_card_not_active')
    return { saved: true }
  })
