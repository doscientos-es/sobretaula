import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type { AuthPrincipal } from '@/features/auth'
import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { TENANT_ROLES, type TenantRole } from '../domain/tenant'

const tenantMembershipInput = z.object({ tenantId: z.string().uuid() })

interface TenantMembership {
  accessToken: string
  role: TenantRole
  tenantId: string
  userId: string
}

export const tenantMembershipMiddleware = createMiddleware({ type: 'function' })
  .validator(tenantMembershipInput)
  .server(async ({ context, data, next }) => {
    const principal = (context as unknown as { principal?: AuthPrincipal } | undefined)?.principal
    if (!principal) throw new Response('Unauthenticated', { status: 401 })

    const { data: membership, error } = await createRequestSupabaseClient(principal.accessToken)
      .from('memberships')
      .select('role, tenant_id')
      .eq('tenant_id', data.tenantId)
      .eq('user_id', principal.userId)
      .eq('status', 'active')
      .maybeSingle()

    if (error) throw new Error(`tenant_membership_lookup_failed:${error.code}`)
    if (!membership || !TENANT_ROLES.includes(membership.role as TenantRole)) {
      throw new Response('Forbidden', { status: 403 })
    }

    const tenantMembership: TenantMembership = {
      accessToken: principal.accessToken,
      role: membership.role as TenantRole,
      tenantId: membership.tenant_id,
      userId: principal.userId,
    }
    return next({ context: { tenantMembership } })
  })

/** Returns only the caller's role after enforcing active membership under RLS. */
export const getTenantMembership = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(tenantMembershipInput)
  .handler(({ context }) => context.tenantMembership)
