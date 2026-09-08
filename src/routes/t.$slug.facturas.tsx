import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { InvoiceListPage } from '@/features/invoices'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/facturas')({
  component: InvoicesRoute,
})

function InvoicesRoute() {
  const { tenant } = tenantRoute.useLoaderData()

  return <InvoiceListPage invoices={[]} locale={tenant.defaultLocale} />
}
