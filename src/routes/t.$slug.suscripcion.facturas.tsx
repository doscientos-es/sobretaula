import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi, redirect } from '@tanstack/react-router'

import { TenantRoutePending, tenantRouteState } from '@/app/tenant-route-loader'
import {
  getTenantPlatformFiscalInvoices,
  PlatformFiscalInvoiceList,
} from '@/features/platform-billing'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/suscripcion/facturas')({
  beforeLoad: ({ context, params }) => {
    if (context.tenantMembership.role !== 'owner') {
      throw redirect({ to: '/t/$slug', params: { slug: params.slug } })
    }
  },
  loader: ({ context }) => ({ tenant: context.tenant }),
  component: TenantPlatformFiscalInvoicesRoute,
  ...tenantRouteState,
})

function TenantPlatformFiscalInvoicesRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const invoicesQuery = useQuery(platformInvoicesQuery(tenant.id))
  const locale = useLocale(tenant.defaultLocale)
  if (invoicesQuery.isPending) return <TenantRoutePending />
  if (invoicesQuery.error) throw invoicesQuery.error
  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeaderTitle>Suscripción</PageHeaderTitle>
        <PageHeaderDescription>
          Facturas y estado de los cobros de tu suscripción a SobreTaula.
        </PageHeaderDescription>
      </PageHeader>
      <PlatformFiscalInvoiceList
        invoices={invoicesQuery.data}
        locale={locale}
        title="Historial de pagos"
      />
    </section>
  )
}

function platformInvoicesQuery(tenantId: string) {
  return queryOptions({
    queryFn: () => getTenantPlatformFiscalInvoices({ data: { tenantId } }),
    queryKey: ['tenant', tenantId, 'platform-fiscal-invoices'],
    staleTime: 60_000,
  })
}
