import { queryOptions, useQuery } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { AccountPage, getAccount } from '@/features/account'
import { getInvoiceSeries } from '@/features/invoices'
import { getMenu } from '@/features/menu'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/cuenta/$sessionId')({
  component: AccountRoute,
})

function AccountRoute() {
  const { tenantMembership } = Route.useRouteContext()
  const { tenant, venue } = Route.useLoaderData()
  const sessionId = Route.useParams().sessionId
  const accountQuery = useQuery(
    accountQueryOptions({ sessionId, tenantId: tenant.id, venueId: venue.id }),
  )
  const menuQuery = useQuery(menuQueryOptions(tenant.id))
  const seriesQuery = useQuery(invoiceSeriesQueryOptions(tenant.id))
  const locale = useLocale(tenant.defaultLocale)
  if (accountQuery.isPending || menuQuery.isPending || seriesQuery.isPending)
    return <TenantRoutePending />
  if (accountQuery.error) throw accountQuery.error
  if (menuQuery.error) throw menuQuery.error
  if (seriesQuery.error) throw seriesQuery.error

  return (
    <AccountPage
      account={accountQuery.data}
      canManageAdjustments={['owner', 'manager'].includes(tenantMembership.role)}
      invoiceSeries={seriesQuery.data}
      locale={locale}
      menu={menuQuery.data}
      tenantId={tenant.id}
      venueId={venue.id}
    />
  )
}

function accountQueryOptions(data: { sessionId: string; tenantId: string; venueId: string }) {
  return queryOptions({
    queryFn: () => getAccount({ data }),
    queryKey: ['tenant', data.tenantId, 'venue', data.venueId, 'account', data.sessionId],
    staleTime: 5_000,
  })
}

function menuQueryOptions(tenantId: string) {
  return queryOptions({
    queryFn: () => getMenu({ data: { tenantId } }),
    queryKey: ['tenant', tenantId, 'menu-catalog'],
    staleTime: 60_000,
  })
}

function invoiceSeriesQueryOptions(tenantId: string) {
  return queryOptions({
    queryFn: () => getInvoiceSeries({ data: { tenantId } }),
    queryKey: ['tenant', tenantId, 'invoice-series'],
    staleTime: 60_000,
  })
}
