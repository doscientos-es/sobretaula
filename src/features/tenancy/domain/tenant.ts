import type { Locale } from '@/shared/lib/i18n/locale'

export const TENANT_STATUSES = ['trial', 'active', 'suspended'] as const
export type TenantStatus = (typeof TENANT_STATUSES)[number]

export const TENANT_ROLES = ['owner', 'manager', 'host', 'waiter', 'accountant'] as const
export type TenantRole = (typeof TENANT_ROLES)[number]

export const PLATFORM_ROLES = ['platform_owner', 'platform_support'] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export interface Tenant {
  id: string
  slug: string
  name: string
  status: TenantStatus
  defaultLocale: Locale
  timezone: string
}

/** A suspended tenant keeps its data but stops serving the operational app. */
export function isTenantOperational(status: TenantStatus): boolean {
  return status === 'trial' || status === 'active'
}
