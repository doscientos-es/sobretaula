export const PLATFORM_ADMIN_ROLES = ['platform_owner', 'platform_support'] as const
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number]

export const MANAGED_TENANT_STATUSES = ['active', 'suspended'] as const
export type ManagedTenantStatus = (typeof MANAGED_TENANT_STATUSES)[number]

export function isPlatformAdminRole(role: string): role is PlatformAdminRole {
  return PLATFORM_ADMIN_ROLES.some((candidate) => candidate === role)
}

/** Never permits an owner to remove their own access or the last owner. */
export function canManagePlatformOperator({
  actorId,
  ownerCount,
  targetId,
  targetRole,
}: {
  actorId: string
  ownerCount: number
  targetId: string
  targetRole: PlatformAdminRole
}): boolean {
  if (actorId === targetId) return false
  return targetRole !== 'platform_owner' || ownerCount > 1
}

/** Manual controls deliberately exclude billing and onboarding-only states. */
export function isManagedTenantStatus(status: string): status is ManagedTenantStatus {
  return MANAGED_TENANT_STATUSES.some((candidate) => candidate === status)
}
