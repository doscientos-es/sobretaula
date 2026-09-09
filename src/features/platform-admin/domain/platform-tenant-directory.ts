export type DirectorySubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | null

export interface PlatformTenantDirectoryEntry {
  createdAt: string
  id: string
  name: string
  slug: string
  status: 'active' | 'setup_pending' | 'suspended' | 'trial'
  subscription: {
    nextPaymentOn: string | null
    planName: string
    status: Exclude<DirectorySubscriptionStatus, null>
  } | null
}

export type TenantDirectoryOrder = 'name_asc' | 'name_desc' | 'newest' | 'oldest'
export type TenantDirectoryStatus = PlatformTenantDirectoryEntry['status'] | 'all'
export type TenantDirectorySubscription = DirectorySubscriptionStatus | 'all'

export function filterPlatformTenants(
  tenants: readonly PlatformTenantDirectoryEntry[],
  {
    order,
    query,
    status,
    subscription,
  }: {
    order: TenantDirectoryOrder
    query: string
    status: TenantDirectoryStatus
    subscription: TenantDirectorySubscription
  },
): PlatformTenantDirectoryEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('es-ES')
  return tenants
    .filter((tenant) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${tenant.name} ${tenant.slug}`.toLocaleLowerCase('es-ES').includes(normalizedQuery)
      const matchesStatus = status === 'all' || tenant.status === status
      const matchesSubscription =
        subscription === 'all' ||
        (subscription === null
          ? tenant.subscription === null
          : tenant.subscription?.status === subscription)
      return matchesQuery && matchesStatus && matchesSubscription
    })
    .sort((left, right) => {
      if (order === 'name_asc') return left.name.localeCompare(right.name, 'es-ES')
      if (order === 'name_desc') return right.name.localeCompare(left.name, 'es-ES')
      const difference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      return order === 'newest' ? -difference : difference
    })
}
