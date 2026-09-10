import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const input = z.object({ tenantId: z.string().uuid() })
export interface NotificationJobSummary {
  id: string
  channel: string
  type: string
  status: string
  attempts: number
  scheduledFor: string
  lastError: string | null
}

export const getNotificationJobs = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(input)
  .handler(async ({ context, data }): Promise<NotificationJobSummary[]> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: jobs, error } = await supabase
      .from('reservation_notification_jobs')
      .select('attempts, channel, id, last_error, scheduled_for, status, type')
      .eq('tenant_id', data.tenantId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw new Error(`notification_jobs_load_failed:${error.code}`)
    return (jobs ?? []).map((job) => ({
      id: job.id,
      channel: job.channel,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      scheduledFor: job.scheduled_for,
      lastError: job.last_error,
    }))
  })

export const requeueNotificationJob = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(z.object({ tenantId: z.string().uuid(), jobId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: requeued, error } = await supabase.rpc('requeue_reservation_notification_job', {
      p_id: data.jobId,
      p_tenant_id: data.tenantId,
    })
    if (error) throw new Error(`notification_job_requeue_failed:${error.code}`)
    return requeued === true
  })
