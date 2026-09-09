import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { InvoiceListPage } from '@/features/invoices'
import { requireTenantRouteAccess } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/facturas')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  component: InvoicesRoute,
})

function InvoicesRoute() {
  const { tenant } = tenantRoute.useLoaderData()

  return <InvoiceListPage invoices={[]} locale={tenant.defaultLocale} />
}
