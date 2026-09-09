import { createHash, randomBytes } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  createRequestSupabaseClient,
  createServiceSupabaseClient,
} from '@/shared/lib/supabase/server/create-server-client'
import { indexProfilesByUserId } from '@/shared/lib/supabase/profile-index'

import { ASSIGNABLE_TENANT_ROLES, canAssignTeamRole } from '../domain/team'
import { TENANT_ROLES } from '../domain/tenant'
import { tenantMembershipMiddleware } from './require-tenant-membership'

const tenantTeamInput = z.object({ tenantId: z.string().uuid() })
const memberInput = tenantTeamInput.extend({ userId: z.string().uuid() })
const assignableRoleInput = z.enum(ASSIGNABLE_TENANT_ROLES)
const memberRoleInput = z.enum(TENANT_ROLES)
const memberStatusInput = z.enum(['active', 'suspended'])
const inviteInput = tenantTeamInput.extend({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(120),
  role: assignableRoleInput,
})
const updateRoleInput = memberInput.extend({ role: assignableRoleInput })
const invitationTokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/) })

export interface TenantTeamMember {
  email: string
  name: string
  role: (typeof ASSIGNABLE_TENANT_ROLES)[number] | 'owner'
  status: 'active' | 'suspended'
  userId: string
}

export interface TenantTeamInvitation {
  email: string
  expiresAt: string
  role: (typeof ASSIGNABLE_TENANT_ROLES)[number]
}

export interface TenantTeam {
  invitations: TenantTeamInvitation[]
  members: TenantTeamMember[]
}

function requireAssignableRole(
  actorRole: Parameters<typeof canAssignTeamRole>[0],
  role: z.infer<typeof assignableRoleInput>,
) {
  if (!canAssignTeamRole(actorRole, role)) throw new Response('Forbidden', { status: 403 })
}

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function invitationRedirect(token: string): string {
  const appUrl = process.env.APP_URL
  if (!appUrl) throw new Error('app_url_not_configured')
  const url = new URL('/activar-cuenta', appUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

/** Lists member profiles and pending invitations visible to the current tenant manager. */
export const getTenantTeam = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(tenantTeamInput)
  .handler(async ({ context, data }): Promise<TenantTeam> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const membersResult = await supabase
      .from('memberships')
      .select('user_id, role, status')
      .eq('tenant_id', data.tenantId)
      .order('created_at')
    const invitationsResult =
      context.tenantMembership.role === 'owner' || context.tenantMembership.role === 'manager'
        ? await supabase
            .from('invitations')
            .select('email, expires_at, role')
            .eq('tenant_id', data.tenantId)
            .is('accepted_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at')
        : { data: [], error: null }
    if (membersResult.error || invitationsResult.error) throw new Error('tenant_team_load_failed')
    const memberUserIds = (membersResult.data ?? []).map((member) => member.user_id)
    const profilesResult =
      memberUserIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from('profiles')
            .select('display_name, email, user_id')
            .in('user_id', memberUserIds)
    if (profilesResult.error) throw new Error('tenant_team_profiles_load_failed')
    const profilesByUserId = indexProfilesByUserId(profilesResult.data ?? [])

    return {
      invitations: (invitationsResult.data ?? []).map((invitation) => ({
        email: invitation.email,
        expiresAt: invitation.expires_at,
        role: assignableRoleInput.parse(invitation.role),
      })),
      members: (membersResult.data ?? []).map((member) => {
        const profile = profilesByUserId.get(member.user_id)
        return {
          email: profile?.email ?? 'Sin correo disponible',
          name: profile?.display_name ?? 'Usuario pendiente',
          role: memberRoleInput.parse(member.role),
          status: memberStatusInput.parse(member.status),
          userId: member.user_id,
        }
      }),
    }
  })

/** Adds an existing account immediately or emails a one-use invitation to a new worker. */
export const inviteTenantMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(inviteInput)
  .handler(async ({ context, data }) => {
    requireAssignableRole(context.tenantMembership.role, data.role)
    const service = createServiceSupabaseClient()
    const { data: existing, error: existingError } = await service
      .from('profiles')
      .select('user_id')
      .eq('email', data.email)
      .maybeSingle()
    if (existingError) throw new Error(`team_profile_lookup_failed:${existingError.code}`)

    const request = createRequestSupabaseClient(context.tenantMembership.accessToken)
    if (existing) {
      const { error } = await request.rpc('upsert_tenant_member', {
        p_role: data.role,
        p_tenant_id: data.tenantId,
        p_user_id: existing.user_id,
      })
      if (error) throw new Response('Forbidden', { status: 403 })
      return { kind: 'member_added' as const }
    }

    const token = randomBytes(32).toString('base64url')
    const { error: invitationError } = await request.from('invitations').upsert(
      {
        email: data.email,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        role: data.role,
        tenant_id: data.tenantId,
        token_hash: hashInvitationToken(token),
      },
      { onConflict: 'tenant_id,email' },
    )
    if (invitationError) throw new Error(`tenant_invitation_save_failed:${invitationError.code}`)

    const { error: inviteError } = await service.auth.admin.inviteUserByEmail(data.email, {
      data: { display_name: data.name },
      redirectTo: invitationRedirect(token),
    })
    if (inviteError) throw new Error('tenant_invitation_delivery_failed')
    return { kind: 'invitation_sent' as const }
  })

/** Changes a staff role through the database-enforced tenant hierarchy. */
export const updateTenantMemberRole = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(updateRoleInput)
  .handler(async ({ context, data }) => {
    requireAssignableRole(context.tenantMembership.role, data.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).rpc(
      'upsert_tenant_member',
      { p_role: data.role, p_tenant_id: data.tenantId, p_user_id: data.userId },
    )
    if (error) throw new Response('Forbidden', { status: 403 })
  })

/** Disables a worker's tenant access while preserving the audit trail and account. */
export const suspendTenantMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(memberInput)
  .handler(async ({ context, data }) => {
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).rpc(
      'suspend_tenant_member',
      { p_tenant_id: data.tenantId, p_user_id: data.userId },
    )
    if (error) throw new Response('Forbidden', { status: 403 })
  })

/** Accepts the invitation only when the signed-in account owns the invited email. */
export const acceptTenantInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(invitationTokenInput)
  .handler(async ({ context, data }) => {
    const { data: result, error } = await createRequestSupabaseClient(
      context.principal.accessToken,
    ).rpc('accept_tenant_invitation', { p_token_hash: hashInvitationToken(data.token) })
    if (error) throw new Response('Invitation unavailable', { status: 400 })
    const invitation = z.array(z.object({ tenant_slug: z.string().min(1) })).parse(result)[0]
    if (!invitation) throw new Error('tenant_invitation_acceptance_missing')
    return { slug: invitation.tenant_slug }
  })
