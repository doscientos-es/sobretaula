import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute } from '@tanstack/react-router'

import { getPlatformBillingOverview, PlatformBillingOverview } from '@/features/platform-billing'

export const Route = createFileRoute('/admin/facturacion')({
  loader: () => getPlatformBillingOverview(),
  component: PlatformBillingRoute,
})

function PlatformBillingRoute() {
  const subscriptions = Route.useLoaderData()
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <p className="st-page-kicker">Facturación SaaS</p>
          <PageHeaderTitle>Suscripciones y cobros</PageHeaderTitle>
          <PageHeaderDescription>
            Visión operativa de planes, locales facturables y próximos cobros.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <PlatformBillingOverview subscriptions={subscriptions} />
    </main>
  )
}
