import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { InvoiceListPage } from '@/features/invoices'
import { requireTenantRouteAccess } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/facturas')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  component: InvoicesRoute,
})

function InvoicesRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)

  return <InvoiceListPage invoices={[]} locale={locale} />
}
