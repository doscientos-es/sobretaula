import { createFileRoute } from '@tanstack/react-router'

import { AccountPage, getAccount } from '@/features/account'
import { getBillingOverview } from '@/features/invoices'
import { getMenu } from '@/features/menu'
import { requireTenantRouteAccess } from '@/features/tenancy'

export const Route = createFileRoute('/t/$slug/l/$venue/cuenta/$sessionId')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'table_account')
  },
  loader: async ({ context, params }) => {
    const data = {
      sessionId: params.sessionId,
      tenantId: context.tenant.id,
      venueId: context.venue.id,
    }
    const [account, menu, billing] = await Promise.all([
      getAccount({ data }),
      getMenu({ data: { tenantId: context.tenant.id } }),
      getBillingOverview({ data: { tenantId: context.tenant.id } }),
    ])

    return { account, invoiceSeries: billing.series, menu }
  },
  component: AccountRoute,
})

function AccountRoute() {
  const { tenant, tenantMembership, venue } = Route.useRouteContext()
  const { account, invoiceSeries, menu } = Route.useLoaderData()

  return (
    <AccountPage
      account={account}
      canManageAdjustments={['owner', 'manager'].includes(tenantMembership.role)}
      invoiceSeries={invoiceSeries}
      locale={tenant.defaultLocale}
      menu={menu}
      tenantId={tenant.id}
      venueId={venue.id}
    />
  )
}
