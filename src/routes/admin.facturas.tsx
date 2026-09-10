import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformFiscalInvoices, PlatformFiscalInvoiceList } from '@/features/platform-billing'

export const Route = createFileRoute('/admin/facturas')({
  loader: () => loadPlatformRoute('/admin/facturas', () => getPlatformFiscalInvoices()),
  component: PlatformFiscalInvoicesRoute,
  ...platformRouteState,
})

function PlatformFiscalInvoicesRoute() {
  const invoices = Route.useLoaderData()
  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Facturas SaaS emitidas</PageHeaderTitle>
          <PageHeaderDescription>
            Facturas de SobreTaula a los restaurantes. Sólo disponible para superadministradores.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <PlatformFiscalInvoiceList
        invoices={invoices}
        locale="es"
        showTenant
        title="Historial fiscal"
      />
    </main>
  )
}
