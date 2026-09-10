import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformBillingOverview, PlatformBillingOverview } from '@/features/platform-billing'

export const Route = createFileRoute('/admin/facturacion')({
  loader: () => loadPlatformRoute('/admin/facturacion', () => getPlatformBillingOverview()),
  component: PlatformBillingRoute,
  ...platformRouteState,
})

function PlatformBillingRoute() {
  const subscriptions = Route.useLoaderData()
  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
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
