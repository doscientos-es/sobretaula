import { createFileRoute } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { getMenu, MenuPage } from '@/features/menu'
import { requireTenantRouteAccess } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

export const Route = createFileRoute('/t/$slug/carta')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: async ({ context }) => {
    const { tenant } = context
    const catalog = await getMenu({ data: { tenantId: tenant.id } })
    return { catalog, tenant }
  },
  component: MenuRoute,
  ...tenantRouteState,
})

function MenuRoute() {
  const { catalog, tenant } = Route.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)

  return <MenuPage catalog={catalog} locale={locale} tenantId={tenant.id} />
}
