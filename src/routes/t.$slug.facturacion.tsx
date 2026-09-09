import { createFileRoute, notFound } from '@tanstack/react-router'

import { BillingPage, getBillingOverview } from '@/features/invoices'
import { tenantBySlugQuery } from '@/features/tenancy'

export const Route = createFileRoute('/t/$slug/facturacion')({
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

  return (
    <BillingPage
      locale={tenant.defaultLocale}
      onDone={() => window.location.reload()}
      overview={overview}
      tenantId={tenant.id}
    />
  )
}
