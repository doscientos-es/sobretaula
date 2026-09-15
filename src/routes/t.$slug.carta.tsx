import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { TenantRoutePending, tenantRouteState } from '@/app/tenant-route-loader'
import { getMenu, MenuPage } from '@/features/menu'
import { requireTenantRouteAccess } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

export const Route = createFileRoute('/t/$slug/carta')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: ({ context }) => ({ tenant: context.tenant }),
  component: MenuRoute,
  ...tenantRouteState,
})

function MenuRoute() {
  const { tenant } = Route.useLoaderData()
  const catalogQuery = useQuery(menuCatalogQuery(tenant.id))
  const locale = useLocale(tenant.defaultLocale)
  if (catalogQuery.isPending) return <TenantRoutePending />
  if (catalogQuery.error) throw catalogQuery.error

  return <MenuPage catalog={catalogQuery.data} locale={locale} tenantId={tenant.id} />
}

function menuCatalogQuery(tenantId: string) {
  return queryOptions({
    queryFn: () => getMenu({ data: { tenantId } }),
    queryKey: ['tenant', tenantId, 'menu-catalog'],
    staleTime: 60_000,
  })
}
