import { createHash, randomBytes } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { paginationRange } from '@/shared/lib/pagination'
import { isAuthEmailRateLimited } from '@/shared/lib/supabase/auth-email-rate-limit'
import { indexProfilesByUserId } from '@/shared/lib/supabase/profile-index'
import {
  createRequestSupabaseClient,
  createServiceSupabaseClient,
} from '@/shared/lib/supabase/server/create-server-client'

import { ASSIGNABLE_TENANT_ROLES, canAssignTeamRole } from '../domain/team'
import { TENANT_ROLES } from '../domain/tenant'
import { tenantMembershipMiddleware } from './require-tenant-membership'
import { teamInvitationFormInput } from './team-invitation-input'

const tenantTeamInput = z.object({
  tenantId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).default(''),
})
const memberInput = tenantTeamInput.extend({ userId: z.string().uuid() })
const assignableRoleInput = z.enum(ASSIGNABLE_TENANT_ROLES)
const memberRoleInput = z.enum(TENANT_ROLES)
const memberStatusInput = z.enum(['active', 'suspended'])
const inviteInput = tenantTeamInput.merge(teamInvitationFormInput)
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
  page: number
  pageSize: number
  total: number
  hasMore: boolean
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
  const configuredAppUrl = process.env.APP_URL
  const appUrl =
    configuredAppUrl && !configuredAppUrl.includes('localhost')
      ? configuredAppUrl
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : configuredAppUrl
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
    let memberUserIdsQuery = supabase.from('profiles').select('user_id')
    if (data.search)
      memberUserIdsQuery = memberUserIdsQuery.or(
        `display_name.ilike.%${data.search}%,email.ilike.%${data.search}%`,
      )
    const matchingProfiles = data.search ? await memberUserIdsQuery : null
    if (matchingProfiles?.error) throw new Error('tenant_team_profiles_load_failed')
    const { from, to } = paginationRange(data)
    let membersRequest = supabase
      .from('memberships')
      .select('user_id, role, status', { count: 'exact' })
      .eq('tenant_id', data.tenantId)
      .order('created_at')
      .range(from, to)
    if (matchingProfiles)
      membersRequest = membersRequest.in(
        'user_id',
        (matchingProfiles.data ?? []).map((row) => row.user_id),
      )
    const membersResult = await membersRequest
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

    const total = matchingProfiles
      ? (matchingProfiles.data ?? []).length
      : (membersResult.count ?? (membersResult.data ?? []).length)
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
      page: data.page,
      pageSize: data.pageSize,
      total,
      hasMore: to + 1 < total,
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
      if (error) {
        if (error.code === '42501') throw new Response('Forbidden', { status: 403 })
        throw new Error(`team_member_upsert_failed:${error.code}`)
      }
      return { kind: 'member_added' as const }
    }

    if (!data.name)
      throw new Response('tenant_invitation_name_required', {
        status: 422,
      })

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

    const { data: invitedUser, error: inviteError } = await service.auth.admin.inviteUserByEmail(
      data.email,
      {
        data: { display_name: data.name },
        redirectTo: invitationRedirect(token),
      },
    )
    if (isAuthEmailRateLimited(inviteError)) {
      throw new Response('Invitation email rate limited', { status: 429 })
    }
    if (inviteError) throw new Error('tenant_invitation_delivery_failed')
    if (invitedUser.user) {
      const { error: profileError } = await service
        .from('profiles')
        .upsert(
          { user_id: invitedUser.user.id, display_name: data.name, email: data.email },
          { onConflict: 'user_id' },
        )
      if (profileError) throw new Error(`team_profile_sync_failed:${profileError.code}`)
    }
    return { kind: 'invitation_sent' as const }
  })

/** Renews and re-sends a pending tenant invitation without creating a duplicate. */
export const resendTenantInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(tenantTeamInput.pick({ tenantId: true }).extend({ email: z.string().email() }))
  .handler(async ({ context, data }) => {
    requireAssignableRole(context.tenantMembership.role, 'waiter')
    const service = createServiceSupabaseClient()
    const request = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: invitation, error: invitationError } = await request
      .from('invitations')
      .select('role')
      .eq('tenant_id', data.tenantId)
      .eq('email', data.email)
      .is('accepted_at', null)
      .maybeSingle()
    if (invitationError) throw new Error(`tenant_invitation_lookup_failed:${invitationError.code}`)
    if (!invitation) throw new Response('Invitation not found', { status: 404 })

    const token = randomBytes(32).toString('base64url')
    const { error: updateError } = await request
      .from('invitations')
      .update({
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        token_hash: hashInvitationToken(token),
      })
      .eq('tenant_id', data.tenantId)
      .eq('email', data.email)
      .is('accepted_at', null)
    if (updateError) throw new Error(`tenant_invitation_update_failed:${updateError.code}`)

    const { error: inviteError } = await service.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: invitationRedirect(token),
    })
    if (isAuthEmailRateLimited(inviteError))
      throw new Response('Invitation email rate limited', { status: 429 })
    if (inviteError) throw new Error('tenant_invitation_delivery_failed')
    return { kind: 'invitation_resent' as const, role: invitation.role }
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
