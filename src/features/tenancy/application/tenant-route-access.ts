import type { TenantRole } from '../domain/tenant'

export const TENANT_ROUTE_AREAS = [
  'administration',
  'operations',
  'table_account',
  'venue_management',
] as const
export type TenantRouteArea = (typeof TENANT_ROUTE_AREAS)[number]

const rolesByRouteArea: Record<TenantRouteArea, readonly TenantRole[]> = {
  administration: ['owner', 'manager', 'accountant'],
  operations: ['owner', 'manager', 'host', 'waiter'],
  table_account: ['owner', 'manager', 'waiter'],
  venue_management: ['owner', 'manager'],
}

/** Mirrors the route workspaces and the permissions enforced by their server actions. */
export function canAccessTenantRoute(role: TenantRole, area: TenantRouteArea): boolean {
  return rolesByRouteArea[area].includes(role)
}

export function requireTenantRouteAccess(role: TenantRole, area: TenantRouteArea): void {
  if (!canAccessTenantRoute(role, area)) throw new Response('Forbidden', { status: 403 })
}
