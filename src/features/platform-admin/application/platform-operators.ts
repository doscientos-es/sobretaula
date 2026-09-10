import { createHash, randomBytes } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { isAuthEmailRateLimited } from '@/shared/lib/supabase/auth-email-rate-limit'
import { indexProfilesByUserId } from '@/shared/lib/supabase/profile-index'
import {
  createRequestSupabaseClient,
  createServiceSupabaseClient,
} from '@/shared/lib/supabase/server/create-server-client'

import { createPlatformOwnerClient } from './platform-dashboard'

const platformRoleInput = z.enum(['platform_owner', 'platform_support'])
const operatorInput = z.object({ role: platformRoleInput, userId: z.string().uuid() })
const platformInvitationInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(120),
  role: platformRoleInput,
})
const platformInvitationTokenInput = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/),
})
const tenantStatusInput = z.object({
  reason: z.string().trim().min(5).max(500),
  status: z.enum(['active', 'suspended']),
  tenantId: z.string().uuid(),
})

export interface PlatformOperator {
  createdAt: string
  email: string
  name: string
  role: z.infer<typeof platformRoleInput>
  userId: string
}

export interface PlatformOperatorInvitation {
  email: string
  expiresAt: string
  role: z.infer<typeof platformRoleInput>
}

export interface PlatformOperatorDirectory {
  currentUserId: string
  invitations: PlatformOperatorInvitation[]
  operators: PlatformOperator[]
}

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function invitationRedirect(token: string): string {
  const appUrl = process.env.APP_URL
  if (!appUrl) throw new Error('app_url_not_configured')
  const url = new URL('/activar-cuenta', appUrl)
  url.searchParams.set('scope', 'platform')
  url.searchParams.set('token', token)
  return url.toString()
}

/** Lists the global operators and invitations that only an owner may administer. */
export const getPlatformOperators = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PlatformOperatorDirectory> => {
    const request = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const [operatorsResult, invitationsResult] = await Promise.all([
      request.from('platform_members').select('created_at, role, user_id').order('created_at'),
      request
        .from('platform_invitations')
        .select('email, expires_at, role')
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at'),
    ])
    if (operatorsResult.error || invitationsResult.error) {
      throw new Error('platform_operator_directory_load_failed')
    }
    const operatorUserIds = (operatorsResult.data ?? []).map((operator) => operator.user_id)
    const profilesResult =
      operatorUserIds.length === 0
        ? { data: [], error: null }
        : await request
            .from('profiles')
            .select('display_name, email, user_id')
            .in('user_id', operatorUserIds)
    if (profilesResult.error) throw new Error('platform_operator_profiles_load_failed')
    const profilesByUserId = indexProfilesByUserId(profilesResult.data ?? [])
    return {
      currentUserId: context.principal.userId,
      invitations: (invitationsResult.data ?? []).map((invitation) => ({
        email: invitation.email,
        expiresAt: invitation.expires_at,
        role: platformRoleInput.parse(invitation.role),
      })),
      operators: (operatorsResult.data ?? []).map((operator) => {
        const profile = profilesByUserId.get(operator.user_id)
        return {
          createdAt: operator.created_at,
          email: profile?.email ?? 'Sin correo disponible',
          name: profile?.display_name ?? 'Usuario sin perfil',
          role: platformRoleInput.parse(operator.role),
          userId: operator.user_id,
        }
      }),
    }
  })

/** Invites a new platform operator or grants an existing account its approved role. */
export const invitePlatformOperator = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(platformInvitationInput)
  .handler(async ({ context, data }) => {
    const request = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const service = createServiceSupabaseClient()
    const { data: existing, error: existingError } = await service
      .from('profiles')
      .select('user_id')
      .eq('email', data.email)
      .maybeSingle()
    if (existingError) throw new Error(`platform_profile_lookup_failed:${existingError.code}`)

    if (existing) {
      const { error } = await request.rpc('grant_platform_member', {
        p_role: data.role,
        p_user_id: existing.user_id,
      })
      if (error) throw new Response('Forbidden', { status: 403 })
      return { kind: 'member_granted' as const }
    }

    const token = randomBytes(32).toString('base64url')
    const { error: invitationError } = await request.rpc('create_platform_invitation', {
      p_email: data.email,
      p_role: data.role,
      p_token_hash: hashInvitationToken(token),
    })
    if (invitationError) throw new Response('Forbidden', { status: 403 })
    const { error: deliveryError } = await service.auth.admin.inviteUserByEmail(data.email, {
      data: { display_name: data.name },
      redirectTo: invitationRedirect(token),
    })
    if (isAuthEmailRateLimited(deliveryError)) {
      throw new Response('Platform invitation email rate limited', { status: 429 })
    }
    if (deliveryError) throw new Error('platform_invitation_delivery_failed')
    return { kind: 'invitation_sent' as const }
  })

/** Changes another operator's role; the database preserves the last platform owner. */
export const updatePlatformOperatorRole = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(operatorInput)
  .handler(async ({ context, data }) => {
    const request = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { error } = await request.rpc('set_platform_member_role', {
      p_role: data.role,
      p_user_id: data.userId,
    })
    if (error) throw new Response('Forbidden', { status: 403 })
  })

/** Revokes another operator while retaining an immutable audit event. */
export const revokePlatformOperator = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const request = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { error } = await request.rpc('revoke_platform_member', { p_user_id: data.userId })
    if (error) throw new Response('Forbidden', { status: 403 })
  })

/** Applies an audited manual tenant suspension or recovery; billing states remain automatic. */
export const updatePlatformTenantStatus = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(tenantStatusInput)
  .handler(async ({ context, data }) => {
    const request = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { error } = await request.rpc('set_platform_tenant_status', {
      p_reason: data.reason,
      p_status: data.status,
      p_tenant_id: data.tenantId,
    })
    if (error) throw new Response('Forbidden', { status: 403 })
  })

/** Completes an email-bound platform invitation for the current authenticated account. */
export const acceptPlatformInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(platformInvitationTokenInput)
  .handler(async ({ context, data }) => {
    const { error } = await createRequestSupabaseClient(context.principal.accessToken).rpc(
      'accept_platform_invitation',
      { p_token_hash: hashInvitationToken(data.token) },
    )
    if (error) throw new Response('Invitation unavailable', { status: 400 })
  })
