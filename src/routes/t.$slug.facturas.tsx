import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { getBillingOverview, InvoiceListPage } from '@/features/invoices'
import { requireTenantRouteAccess } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/facturas')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: async ({ context }) => {
    const { tenant } = context
    return getBillingOverview({ data: { tenantId: tenant.id } })
  },
  component: InvoicesRoute,
  ...tenantRouteState,
})

function InvoicesRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const { invoices } = Route.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)

  return <InvoiceListPage invoices={invoices} locale={locale} />
}
