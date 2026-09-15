import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute, getRouteApi, redirect } from '@tanstack/react-router'

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
  loader: async ({ context }) => {
    const { tenant } = context
    return getTenantPlatformFiscalInvoices({ data: { tenantId: tenant.id } })
  },
  component: TenantPlatformFiscalInvoicesRoute,
})

function TenantPlatformFiscalInvoicesRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const invoices = Route.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)
  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeaderTitle>Suscripción</PageHeaderTitle>
        <PageHeaderDescription>
          Tu historial de pagos, no incluye las facturas que emites a tus clientes.
        </PageHeaderDescription>
      </PageHeader>
      <PlatformFiscalInvoiceList invoices={invoices} locale={locale} title="Historial de pagos" />
    </section>
  )
}
