import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type { AuthPrincipal } from '@/features/auth'
import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { isTenantOperational, TENANT_ROLES, type TenantRole } from '../domain/tenant'

const tenantMembershipInput = z.object({ tenantId: z.string().uuid() })

/**
 * Validates the tenant address without removing fields required by the server
 * function that follows this middleware in the chain.
 */
export function validateTenantMembershipInput<T>(data: T): T {
  tenantMembershipInput.parse(data)
  return data
}

interface TenantMembership {
  accessToken: string
  role: TenantRole
  tenantId: string
  userId: string
}

export const tenantMembershipMiddleware = createMiddleware({ type: 'function' })
  .validator(validateTenantMembershipInput)
  .server(async ({ context, data, next }) => {
    const principal = (context as unknown as { principal?: AuthPrincipal } | undefined)?.principal
    if (!principal) throw new Response('Unauthenticated', { status: 401 })
    const { tenantId } = tenantMembershipInput.parse(data)

    const { data: membership, error } = await createRequestSupabaseClient(principal.accessToken)
      .from('memberships')
      .select('role, tenant_id')
      .eq('tenant_id', tenantId)
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

/** Blocks operational server functions after the billing grace period expires. */
export const operationalTenantMiddleware = createMiddleware({
  type: 'function',
}).server(async ({ context, next }) => {
  const tenantMembership = (context as unknown as { tenantMembership?: TenantMembership })
    .tenantMembership
  if (!tenantMembership) throw new Response('Unauthenticated', { status: 401 })

  const supabase = createRequestSupabaseClient(tenantMembership.accessToken)
  const [{ data: tenant, error }, { error: subscriptionError }] = await Promise.all([
    supabase.from('tenants').select('status').eq('id', tenantMembership.tenantId).single(),
    supabase
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', tenantMembership.tenantId)
      .maybeSingle(),
  ])
  if (error || subscriptionError || !tenant) throw new Response('Forbidden', { status: 403 })
  if (tenant.status === 'suspended') throw new Response('Tenant suspended', { status: 423 })
  if (!isTenantOperational(tenant.status))
    throw new Response('Onboarding and payment required', { status: 402 })
  // A paid subscription activates the tenant. A legacy trialing subscription
  // must not make a non-paid tenant operational.
  return next()
})

/** Returns only the caller's role after enforcing active membership under RLS. */
export const getTenantMembership = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(tenantMembershipInput)
  .handler(({ context }) => context.tenantMembership)
