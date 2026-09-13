import { createFileRoute, notFound } from '@tanstack/react-router'

import { AccountPage, getAccount } from '@/features/account'
import { getBillingOverview } from '@/features/invoices'
import { getMenu } from '@/features/menu'
import { requireTenantRouteAccess } from '@/features/tenancy'
import { loadVenueRouteContext } from '@/features/venues'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

export const Route = createFileRoute('/t/$slug/l/$venue/cuenta/$sessionId')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'table_account')
  },
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    const data = {
      sessionId: params.sessionId,
      tenantId: tenant.id,
      venueId: venue.id,
    }
    const [account, menu, billing] = await Promise.all([
      getAccount({ data }),
      getMenu({ data: { tenantId: tenant.id } }),
      getBillingOverview({ data: { tenantId: tenant.id } }),
    ])

    return { account, invoiceSeries: billing.series, menu, tenant, venue }
  },
  component: AccountRoute,
})

function AccountRoute() {
  const { tenantMembership } = Route.useRouteContext()
  const { account, invoiceSeries, menu, tenant, venue } = Route.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)

  return (
    <AccountPage
      account={account}
      canManageAdjustments={['owner', 'manager'].includes(tenantMembership.role)}
      invoiceSeries={invoiceSeries}
      locale={locale}
      menu={menu}
      tenantId={tenant.id}
      venueId={venue.id}
    />
  )
}
