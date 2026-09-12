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

import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator, type MessageKey } from '@/shared/lib/i18n/messages'
import { formatMoney } from '@/shared/lib/money/money'

import type { PlatformFiscalInvoice } from '../application/get-platform-fiscal-invoices'

function statusLabel(status: PlatformFiscalInvoice['status'], locale: Locale): string {
  const key = {
    issued: 'platform.status.issued',
    pending_review: 'platform.status.pendingReview',
    registered: 'platform.status.registered',
  }[status] as MessageKey
  return createTranslator(locale)(key)
}

export function PlatformFiscalInvoiceList({
  invoices,
  locale,
  showTenant = false,
  title,
}: {
  invoices: readonly PlatformFiscalInvoice[]
  locale: Locale
  showTenant?: boolean
  title: string
}) {
  const t = createTranslator(locale)

  if (invoices.length === 0) {
    return (
      <DataViewState>
        <DataViewStateTitle>{title}</DataViewStateTitle>
        <DataViewStateDescription>{t('platform.noFiscalInvoices')}</DataViewStateDescription>
      </DataViewState>
    )
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{t('platform.fiscalInvoiceDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <section aria-label={title}>
          <Table className="min-w-[680px] text-left">
            <TableHeader className="text-muted-foreground">
              <TableRow>
                {showTenant && <TableHead>{t('platform.restaurant')}</TableHead>}
                <TableHead>{t('platform.invoice')}</TableHead>
                <TableHead>{t('platform.period')}</TableHead>
                <TableHead>{t('platform.total')}</TableHead>
                <TableHead>{t('platform.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  {showTenant && <TableCell>{invoice.tenantName}</TableCell>}
                  <TableCell className="font-medium">
                    {invoice.fullNumber ?? t('platform.unnumbered')}
                  </TableCell>
                  <TableCell>
                    {invoice.periodStart} — {invoice.periodEnd}
                  </TableCell>
                  <TableCell>{formatMoney(invoice.totalCents, locale)}</TableCell>
                  <TableCell>
                    {statusLabel(invoice.status, locale)}
                    {invoice.reviewReason ? ` · ${invoice.reviewReason}` : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </CardContent>
    </Card>
  )
}
