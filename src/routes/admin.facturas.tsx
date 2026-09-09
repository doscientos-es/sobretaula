import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getPlatformFiscalInvoices, PlatformFiscalInvoiceList } from '@/features/platform-billing'

export const Route = createFileRoute('/admin/facturas')({
  loader: async () => {
    try {
      return await getPlatformFiscalInvoices()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/admin/facturas' } })
      }
      throw error
    }
  },
  component: PlatformFiscalInvoicesRoute,
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
