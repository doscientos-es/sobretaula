import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@doscientos/ui'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { TenantRoutePending, tenantRouteState } from '@/app/tenant-route-loader'
import { getTenantInvoices, InvoiceListPage } from '@/features/invoices'
import { requireTenantRouteAccess } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/facturas')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: ({ context }) => ({ tenant: context.tenant }),
  component: InvoicesRoute,
  ...tenantRouteState,
})

function InvoicesRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const invoicesQuery = useQuery(tenantInvoicesQuery(tenant.id))
  const locale = useLocale(tenant.defaultLocale)
  if (invoicesQuery.isPending) return <TenantRoutePending />
  if (invoicesQuery.error) {
    return (
      <main className="mx-auto w-full max-w-2xl p-6 sm:p-10">
        <Card role="alert">
          <CardHeader>
            <CardTitle>No se han podido cargar las facturas</CardTitle>
            <CardDescription>
              Ha ocurrido un problema al consultar el libro de facturas. Reintenta la operación; si
              continúa, contacta con soporte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onPress={() => void invoicesQuery.refetch()} type="button">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return <InvoiceListPage invoices={invoicesQuery.data} locale={locale} />
}

function tenantInvoicesQuery(tenantId: string) {
  return queryOptions({
    queryFn: () => getTenantInvoices({ data: { page: 1, pageSize: 100, search: '', tenantId } }),
    queryKey: ['tenant', tenantId, 'invoices'],
    staleTime: 60_000,
  })
}
