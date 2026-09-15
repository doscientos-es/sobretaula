import { createFileRoute } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { BillingPage, getBillingOverview } from '@/features/invoices'
import { requireTenantRouteAccess } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createFileRoute('/t/$slug/facturacion')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: async ({ context }) => {
    const { tenant } = context
    const overview = await getBillingOverview({ data: { tenantId: tenant.id } })
    return { overview, tenant }
  },
  component: BillingRoute,
  ...tenantRouteState,
})

function BillingRoute() {
  const { overview, tenant } = Route.useLoaderData()
  const reload = useLoaderReload()
  const locale = useLocale(tenant.defaultLocale)

  return (
    <BillingPage
      locale={locale}
      isOwner={Route.useRouteContext().tenantMembership.role === 'owner'}
      onDone={reload}
      overview={overview}
      tenantId={tenant.id}
    />
  )
}
