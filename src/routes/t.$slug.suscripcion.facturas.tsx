import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute, getRouteApi, notFound, redirect } from '@tanstack/react-router'

import {
  getTenantPlatformFiscalInvoices,
  PlatformFiscalInvoiceList,
} from '@/features/platform-billing'
import { tenantBySlugQuery } from '@/features/tenancy'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/suscripcion/facturas')({
  beforeLoad: ({ context, params }) => {
    if (context.tenantMembership.role !== 'owner') {
      throw redirect({ to: '/t/$slug', params: { slug: params.slug } })
    }
  },
  loader: async ({ context, params }) => {
    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(params.slug))
    if (!tenant) throw notFound()
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
