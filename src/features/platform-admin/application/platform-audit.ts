import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { indexProfilesByUserId } from '@/shared/lib/supabase/profile-index'

import {
  PLATFORM_AUDIT_ACTIONS,
  platformAuditSummary,
  type PlatformAuditEvent,
} from '../domain/platform-audit'
import { createPlatformOwnerClient } from './platform-dashboard'

const auditLogInput = z.object({ tenantId: z.string().uuid().optional() })
const auditRowSchema = z.object({
  action: z.enum(PLATFORM_AUDIT_ACTIONS),
  actor_user_id: z.string().uuid().nullable(),
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  metadata: z.record(z.unknown()),
  target_id: z.string().uuid(),
  target_type: z.enum(['platform_invitation', 'platform_member', 'tenant']),
})

/** Reads immutable platform events; tenant filtering only includes tenant-targeted actions. */
export const getPlatformAuditLog = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(auditLogInput)
  .handler(async ({ context, data }): Promise<PlatformAuditEvent[]> => {
    const supabase = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    let request = supabase
      .from('platform_audit_log')
      .select('action, actor_user_id, created_at, id, metadata, target_id, target_type')
      .order('created_at', { ascending: false })
      .limit(100)
    if (data.tenantId) request = request.eq('target_type', 'tenant').eq('target_id', data.tenantId)
    const { data: rows, error } = await request
    if (error) throw new Error(`platform_audit_log_load_failed:${error.code}`)

    const events = (rows ?? []).map((row) => auditRowSchema.parse(row))
    const userIds = Array.from(
      new Set(events.flatMap((event) => (event.actor_user_id ? [event.actor_user_id] : []))),
    )
    const tenantIds = Array.from(
      new Set(events.flatMap((event) => (event.target_type === 'tenant' ? [event.target_id] : []))),
    )
    const [profilesResult, tenantsResult] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('display_name, email, user_id').in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      tenantIds.length
        ? supabase.from('tenants').select('id, name').in('id', tenantIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (profilesResult.error || tenantsResult.error)
      throw new Error('platform_audit_log_context_failed')

    const profilesByUserId = indexProfilesByUserId(profilesResult.data ?? [])
    const tenantsById = new Map(
      (tenantsResult.data ?? []).map((tenant) => [tenant.id, tenant.name]),
    )
    return events.map((event) => {
      const actor = event.actor_user_id ? profilesByUserId.get(event.actor_user_id) : undefined
      const target =
        event.target_type === 'tenant'
          ? (tenantsById.get(event.target_id) ?? 'Tenant eliminado')
          : event.target_type === 'platform_member'
            ? (profilesByUserId.get(event.target_id)?.display_name ?? 'Operador de plataforma')
            : 'Invitación de operador'
      return {
        action: event.action,
        actor: actor?.display_name ?? actor?.email ?? 'Usuario eliminado',
        createdAt: event.created_at,
        id: event.id,
        summary: platformAuditSummary(event.action, event.metadata),
        target,
      }
    })
  })
