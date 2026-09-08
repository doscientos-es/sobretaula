import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  getPlatformFiscalInvoices,
  PlatformFiscalInvoiceList,
} from '@/features/platform-billing'

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
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader>
        <PageHeaderTitle>Facturas SaaS emitidas</PageHeaderTitle>
        <PageHeaderDescription>
          Facturas de SobreTaula a los restaurantes. Sólo disponible para superadministradores.
        </PageHeaderDescription>
      </PageHeader>
      <PlatformFiscalInvoiceList invoices={invoices} locale="es" showTenant title="Historial fiscal" />
    </main>
  )
}