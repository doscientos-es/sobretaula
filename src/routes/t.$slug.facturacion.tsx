import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { TenantRoutePending, tenantRouteState } from '@/app/tenant-route-loader'
import { BillingPage, getBillingOverview } from '@/features/invoices'
import { requireTenantRouteAccess } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createFileRoute('/t/$slug/facturacion')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: ({ context }) => ({ tenant: context.tenant }),
  component: BillingRoute,
  ...tenantRouteState,
})

function BillingRoute() {
  const { tenant } = Route.useLoaderData()
  const overviewQuery = useQuery(billingOverviewQuery(tenant.id))
  const reload = useLoaderReload()
  const locale = useLocale(tenant.defaultLocale)
  const { tenantMembership } = Route.useRouteContext()
  if (overviewQuery.isPending) return <TenantRoutePending />
  if (overviewQuery.error) throw overviewQuery.error

  return (
    <BillingPage
      locale={locale}
      isOwner={tenantMembership.role === 'owner'}
      onDone={() => void reload()}
      overview={overviewQuery.data}
      tenantId={tenant.id}
    />
  )
}

function billingOverviewQuery(tenantId: string) {
  return queryOptions({
    queryFn: () => getBillingOverview({ data: { tenantId } }),
    queryKey: ['tenant', tenantId, 'billing-overview'],
    staleTime: 60_000,
  })
}
