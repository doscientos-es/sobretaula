import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { getBillingOverview, InvoiceListPage } from '@/features/invoices'
import { requireTenantRouteAccess, tenantBySlugQuery } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/facturas')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: async ({ context, params }) => {
    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(params.slug))
    if (!tenant) throw new Response('Not Found', { status: 404 })
    return getBillingOverview({ data: { tenantId: tenant.id } })
  },
  component: InvoicesRoute,
})

function InvoicesRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const { invoices } = Route.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)

  return <InvoiceListPage invoices={invoices} locale={locale} />
}
