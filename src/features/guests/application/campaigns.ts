import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { paginationRange, type PaginatedResult } from '@/shared/lib/pagination'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { canAdvanceCampaign } from '../domain/campaign-status'
const middleware = [
  authMiddleware,
  tenantMembershipMiddleware,
  operationalTenantMiddleware,
] as const
export interface CampaignSummary {
  id: string
  name: string
  channel: 'email' | 'sms' | 'whatsapp'
  status: 'draft' | 'scheduled' | 'sent' | 'paused'
  recipients: number
  attributedRevenueCents: number
}
const input = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  channel: z.enum(['email', 'sms', 'whatsapp']),
  segment: z.enum(['vip', 'habitual', 'inactivo', 'nuevo']),
})
export const createGuestCampaign = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(input)
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('guest_campaigns')
      .insert({
        tenant_id: data.tenantId,
        name: data.name,
        channel: data.channel,
        audience_filter: { segment: data.segment },
        created_by: context.tenantMembership.userId,
      })
    if (error) throw new Error(`campaign_create_failed:${error.code}`)
    return { saved: true }
  })

export const updateGuestCampaignStatus = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(
    z.object({
      tenantId: z.string().uuid(),
      campaignId: z.string().uuid(),
      status: z.enum(['scheduled', 'sent', 'paused']),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: campaign, error } = await supabase
      .from('guest_campaigns')
      .select('status')
      .eq('id', data.campaignId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (error || !campaign) throw new Error('campaign_not_found')
    if (
      !canAdvanceCampaign(campaign.status as 'draft' | 'scheduled' | 'sent' | 'paused', data.status)
    )
      throw new Error('campaign_invalid_transition')
    if (data.status === 'sent') {
      const { error: sendError } = await supabase.rpc('send_guest_campaign', {
        p_campaign_id: data.campaignId,
      })
      if (sendError) throw new Error(`campaign_send_failed:${sendError.code}`)
      return { saved: true }
    }
    const { error: updateError } = await supabase
      .from('guest_campaigns')
      .update({
        status: data.status,
        sent_at: null,
      })
      .eq('id', data.campaignId)
      .eq('tenant_id', data.tenantId)
    if (updateError) throw new Error(`campaign_status_failed:${updateError.code}`)
    return { saved: true }
  })
export const listGuestCampaigns = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(
    z.object({
      tenantId: z.string().uuid(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }),
  )
  .handler(async ({ context, data }): Promise<PaginatedResult<CampaignSummary>> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const range = paginationRange(data)
    const {
      data: campaigns,
      error,
      count,
    } = await supabase
      .from('guest_campaigns')
      .select('id, name, channel, status', { count: 'exact' })
      .eq('tenant_id', data.tenantId)
      .order('created_at', { ascending: false })
      .range(range.from, range.to)
    if (error) throw new Error(`campaigns_load_failed:${error.code}`)
    const ids = (campaigns ?? []).map((campaign) => campaign.id)
    const { data: recipients, error: recipientError } = ids.length
      ? await supabase
          .from('guest_campaign_recipients')
          .select('campaign_id, attributed_revenue_cents')
          .eq('tenant_id', data.tenantId)
          .in('campaign_id', ids)
      : { data: [], error: null }
    if (recipientError) throw new Error(`campaign_metrics_failed:${recipientError.code}`)
    const items = (campaigns ?? []).map((campaign) => {
      const rows = (recipients ?? []).filter((recipient) => recipient.campaign_id === campaign.id)
      return {
        ...campaign,
        recipients: rows.length,
        attributedRevenueCents: rows.reduce(
          (sum, row) => sum + Number(row.attributed_revenue_cents ?? 0),
          0,
        ),
      }
    })
    const total = count ?? 0
    return { hasMore: range.to + 1 < total, items, page: data.page, pageSize: data.pageSize, total }
  })
