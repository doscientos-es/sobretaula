import type { TenantRole } from './tenant'

export const ASSIGNABLE_TENANT_ROLES = ['manager', 'host', 'waiter', 'accountant'] as const
export type AssignableTenantRole = (typeof ASSIGNABLE_TENANT_ROLES)[number]

/** Owners manage every non-owner role; managers only manage operational staff. */
export function canAssignTeamRole(actorRole: TenantRole, targetRole: AssignableTenantRole): boolean {
  return actorRole === 'owner' || (actorRole === 'manager' && targetRole !== 'manager')
}

/** No user can disable themselves or modify an owner through the normal team UI. */
export function canManageTeamMember({
  actorId,
  actorRole,
  targetId,
  targetRole,
}: {
  actorId: string
  actorRole: TenantRole
  targetId: string
  targetRole: TenantRole
}): boolean {
  if (actorId === targetId || targetRole === 'owner') return false
  return canAssignTeamRole(actorRole, targetRole as AssignableTenantRole)
}