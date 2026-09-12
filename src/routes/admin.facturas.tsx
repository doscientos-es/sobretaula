import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformFiscalInvoices, PlatformFiscalInvoiceList } from '@/features/platform-billing'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

export const Route = createFileRoute('/admin/facturas')({
  loader: () => loadPlatformRoute('/admin/facturas', () => getPlatformFiscalInvoices()),
  component: PlatformFiscalInvoicesRoute,
  ...platformRouteState,
})

function PlatformFiscalInvoicesRoute() {
  const invoices = Route.useLoaderData()
  const locale = useLocale('es')
  const t = createTranslator(locale)
  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{t('platform.fiscalInvoicesTitle')}</PageHeaderTitle>
          <PageHeaderDescription>
            {t('platform.fiscalInvoicesDescription')}
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <PlatformFiscalInvoiceList
        invoices={invoices}
        locale={locale}
        showTenant
        title={t('platform.fiscalHistory')}
      />
    </main>
  )
}
