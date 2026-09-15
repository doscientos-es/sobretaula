import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { paginationRange, type PaginatedResult } from '@/shared/lib/pagination'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'
const input = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
  kind: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  periodFrom: z.string().datetime(),
  periodTo: z.string().datetime(),
  source: z.array(z.string()),
  status: z.enum(['accepted', 'ignored', 'snoozed']),
})

const recommendationHistoryInput = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
})

export function recommendationHistoryQuery(data: {
  tenantId: string
  venueId: string
  page?: number
  pageSize?: number
}) {
  const normalized = recommendationHistoryInput.parse(data)
  return queryOptions({
    queryFn: () => listRecommendationDecisions({ data: normalized }),
    queryKey: [
      'tenant',
      normalized.tenantId,
      'venue',
      normalized.venueId,
      'recommendation-history',
      normalized.page,
      normalized.pageSize,
    ],
    staleTime: 30_000,
  })
}
export const decideRecommendation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(input)
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('profitability_recommendations')
      .insert({
        tenant_id: data.tenantId,
        venue_id: data.venueId,
        kind: data.kind,
        title: data.title,
        detail: data.detail,
        period_from: data.periodFrom,
        period_to: data.periodTo,
        source: data.source,
        status: data.status,
        decided_by: context.tenantMembership.userId,
        decided_at: new Date().toISOString(),
      })
    if (error) throw new Error(`recommendation_decision_failed:${error.code}`)
    return { saved: true }
  })

export const listRecommendationDecisions = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(recommendationHistoryInput)
  .handler(
    async ({
      context,
      data,
    }): Promise<
      PaginatedResult<{
        id: string
        title: string
        detail: string
        status: 'accepted' | 'ignored' | 'snoozed'
        decidedAt: string
        periodFrom: string
        periodTo: string
      }>
    > => {
      const {
        data: rows,
        error,
        count,
      } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
        .from('profitability_recommendations')
        .select('id, title, detail, status, decided_at, decided_by, period_from, period_to', {
          count: 'exact',
        })
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .not('decided_at', 'is', null)
        .order('decided_at', { ascending: false })
        .range(...(Object.values(paginationRange(data)) as [number, number]))
      if (error?.code === '42P01')
        return { items: [], page: data.page, pageSize: data.pageSize, total: 0, hasMore: false }
      if (error) throw new Error(`recommendation_history_failed:${error.code}`)
      const items = (rows ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        detail: row.detail as string,
        status: row.status as 'accepted' | 'ignored' | 'snoozed',
        decidedAt: row.decided_at as string,
        periodFrom: row.period_from as string,
        periodTo: row.period_to as string,
      }))
      const total = count ?? items.length
      return {
        items,
        page: data.page,
        pageSize: data.pageSize,
        total,
        hasMore: data.page * data.pageSize < total,
      }
    },
  )
