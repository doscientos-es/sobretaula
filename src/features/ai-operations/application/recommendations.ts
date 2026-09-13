import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
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
