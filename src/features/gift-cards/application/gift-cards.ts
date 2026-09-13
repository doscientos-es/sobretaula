import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { normalizeGiftCardCode } from '../domain/gift-card'
const middleware = [
  authMiddleware,
  tenantMembershipMiddleware,
  operationalTenantMiddleware,
] as const
const base = z.object({ tenantId: z.string().uuid() })
export interface GiftCard {
  id: string
  code: string
  initialBalanceCents: number
  balanceCents: number
  status: string
}
export const listGiftCards = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(base)
  .handler(async ({ context, data }) => {
    const { data: cards, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('gift_cards')
      .select('id, code, initial_balance_cents, balance_cents, status')
      .eq('tenant_id', data.tenantId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw new Error(`gift_cards_load_failed:${error.code}`)
    return (cards ?? []).map((card) => ({
      id: card.id,
      code: card.code,
      initialBalanceCents: Number(card.initial_balance_cents),
      balanceCents: Number(card.balance_cents),
      status: card.status,
    })) satisfies GiftCard[]
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
