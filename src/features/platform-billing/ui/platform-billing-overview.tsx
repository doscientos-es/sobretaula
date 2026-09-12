import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@doscientos/ui'

import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator, formatMessage } from '@/shared/lib/i18n/messages'

import type { PlatformSubscriptionOverview } from '../application/get-platform-billing-overview'

function statusLabel(status: PlatformSubscriptionOverview['status'], locale: 'es' | 'ca'): string {
  const key = {
    active: 'platform.status.active',
    canceled: 'platform.status.canceled',
    past_due: 'platform.status.pastDue',
    trialing: 'platform.status.trialing',
  }[status] as const
  return createTranslator(locale)(key)
}

export function PlatformBillingOverview({
  subscriptions,
}: {
  subscriptions: PlatformSubscriptionOverview[]
}) {
  const locale = useLocale('es')
  const t = createTranslator(locale)
  const euro = new Intl.NumberFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    currency: 'EUR',
    style: 'currency',
  })

  if (subscriptions.length === 0) {
    return (
      <DataViewState>
        <DataViewStateTitle>{t('platform.noSubscriptions')}</DataViewStateTitle>
        <DataViewStateDescription>
          {t('platform.noSubscriptionsDescription')}
        </DataViewStateDescription>
      </DataViewState>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('platform.activeSubscriptions')}</CardTitle>
        <CardDescription>{t('platform.subscriptionsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <section aria-label={t('platform.subscriptionsAria')}>
          <Table className="min-w-[720px] text-left">
            <TableHeader className="text-muted-foreground">
              <TableRow>
                <TableHead>{t('platform.restaurant')}</TableHead>
                <TableHead>{t('platform.netPlan')}</TableHead>
                <TableHead>{t('platform.venues')}</TableHead>
                <TableHead>{t('platform.netTotal')}</TableHead>
                <TableHead>{t('platform.subscription')}</TableHead>
                <TableHead>{t('platform.nextPayment')}</TableHead>
                <TableHead>{t('platform.tenant')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((subscription) => (
                <TableRow key={subscription.tenantSlug}>
                  <TableCell className="font-medium">{subscription.tenantName}</TableCell>
                  <TableCell>
                    {subscription.planName} · {euro.format(subscription.planMonthlyNetCents / 100)}
                    {t('platform.month')}
                  </TableCell>
                  <TableCell>{subscription.venueCount}</TableCell>
                  <TableCell>
                    {euro.format(subscription.monthlyNetCents / 100)}
                    {t('platform.month')}
                  </TableCell>
                  <TableCell>
                    {statusLabel(subscription.status, locale)}
                    {subscription.graceEndsOn
                      ? ` · ${formatMessage(locale, 'platform.graceUntil', { date: subscription.graceEndsOn })}`
                      : ''}
                  </TableCell>
                  <TableCell>{subscription.nextPaymentOn ?? t('platform.unscheduled')}</TableCell>
                  <TableCell className="capitalize">{subscription.tenantStatus}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </CardContent>
    </Card>
  )
}
