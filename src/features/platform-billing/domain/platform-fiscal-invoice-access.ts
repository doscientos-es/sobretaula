import type { TenantRole } from '@/features/tenancy/domain/tenant'

const administrativeTenantRoles: readonly TenantRole[] = ['owner', 'manager', 'accountant']

/** Only tenant billing administrators can read invoices issued by SobreTaula. */
export function canViewPlatformFiscalInvoices(role: TenantRole): boolean {
  return administrativeTenantRoles.includes(role)
}