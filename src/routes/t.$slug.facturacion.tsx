import { createFileRoute, notFound } from '@tanstack/react-router'

import { BillingPage, getBillingOverview } from '@/features/invoices'
import { requireTenantRouteAccess, tenantBySlugQuery } from '@/features/tenancy'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createFileRoute('/t/$slug/facturacion')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: async ({ context, params }) => {
    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(params.slug))
    if (!tenant) throw notFound()
    const overview = await getBillingOverview({ data: { tenantId: tenant.id } })
    return { overview, tenant }
  },
  component: BillingRoute,
})

function BillingRoute() {
  const { overview, tenant } = Route.useLoaderData()
  const reload = useLoaderReload()

  return (
    <BillingPage
      locale={tenant.defaultLocale}
      onDone={reload}
      overview={overview}
      tenantId={tenant.id}
    />
  )
}
