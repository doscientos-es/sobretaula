import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformBillingOverview, PlatformBillingOverview } from '@/features/platform-billing'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

export const Route = createFileRoute('/admin/facturacion')({
  loader: () => loadPlatformRoute('/admin/facturacion', () => getPlatformBillingOverview()),
  component: PlatformBillingRoute,
  ...platformRouteState,
})

function PlatformBillingRoute() {
  const subscriptions = Route.useLoaderData()
  const locale = useLocale('es')
  const t = createTranslator(locale)
  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{t('platform.billingTitle')}</PageHeaderTitle>
          <PageHeaderDescription>{t('platform.billingDescription')}</PageHeaderDescription>
        </div>
      </PageHeader>
      <PlatformBillingOverview subscriptions={subscriptions} />
    </main>
  )
}
