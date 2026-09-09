import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import {
  getTenantPlatformFiscalInvoices,
  PlatformFiscalInvoiceList,
} from '@/features/platform-billing'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/suscripcion/facturas')({
  loader: async () => {
    const { tenant } = tenantRoute.useLoaderData()
    return getTenantPlatformFiscalInvoices({ data: { tenantId: tenant.id } })
  },
  component: TenantPlatformFiscalInvoicesRoute,
})

function TenantPlatformFiscalInvoicesRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const invoices = Route.useLoaderData()
  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeaderTitle>Facturas de SobreTaula</PageHeaderTitle>
        <PageHeaderDescription>
          Historial de las facturas de la suscripción de {tenant.name}. No incluye las facturas a
          tus clientes.
        </PageHeaderDescription>
      </PageHeader>
      <PlatformFiscalInvoiceList
        invoices={invoices}
        locale={tenant.defaultLocale}
        title="Historial de suscripción"
      />
    </section>
  )
}
