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
  Button,
  FormFeedback,
  useFormFeedback,
} from '@doscientos/ui'

import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator, type MessageKey } from '@/shared/lib/i18n/messages'
import { formatMoney } from '@/shared/lib/money/money'

import { getPlatformFiscalInvoiceDocument } from '../application/get-platform-fiscal-invoice-document'
import type {
  PlatformBillingInvoiceStatus,
  PlatformFiscalInvoice,
} from '../application/get-platform-fiscal-invoices'

function statusLabel(status: PlatformFiscalInvoice['status'], locale: Locale): string {
  const key = {
    issued: 'platform.status.issued',
    pending_review: 'platform.status.pendingReview',
    registered: 'platform.status.registered',
  }[status] as MessageKey
  return createTranslator(locale)(key)
}

function paymentStatusLabel(status: PlatformBillingInvoiceStatus, locale: Locale): string {
  const key = {
    failed: 'platform.paymentStatus.failed',
    open: 'platform.paymentStatus.pending',
    paid: 'platform.paymentStatus.paid',
    void: 'platform.paymentStatus.void',
  }[status] as MessageKey
  return createTranslator(locale)(key)
}

function reviewReasonLabel(reason: string | null, locale: Locale): string | null {
  if (!reason) return null
  if (reason === 'platform_fiscal_settings_missing_or_disabled') {
    return createTranslator(locale)('platform.reviewReason.settingsMissing')
  }
  return reason
}

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function InvoicePdfButton({ invoice, locale }: { invoice: PlatformFiscalInvoice; locale: Locale }) {
  const feedback = useFormFeedback()

  function download() {
    if (feedback.pending) return
    feedback.setPending()
    void getPlatformFiscalInvoiceDocument({
      data: { invoiceId: invoice.id, tenantId: invoice.tenantId },
    })
      .then((result) => {
        feedback.reset()
        window.open(result.signedUrl, '_blank', 'noopener,noreferrer')
      })
      .catch(() => feedback.setError('No se ha podido preparar el PDF.'))
  }

  return (
    <span className="inline-flex items-center gap-2">
      <FormFeedback pendingLabel="Preparando PDF…" state={feedback.state} />
      <Button
        disabled={feedback.pending}
        onClick={download}
        size="sm"
        type="button"
        variant="ghost"
      >
        {feedback.pending
          ? locale === 'ca'
            ? 'Preparant…'
            : 'Preparando…'
          : locale === 'ca'
            ? invoice.status === 'pending_review'
              ? 'Descarregar esborrany'
              : 'Descarregar PDF'
            : invoice.status === 'pending_review'
              ? 'Descargar borrador'
              : 'Descargar PDF'}
      </Button>
    </span>
  )
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
          <div className="overflow-x-auto">
            <Table className="min-w-[760px] text-left">
              <TableHeader className="text-muted-foreground">
                <TableRow>
                  {showTenant && <TableHead>{t('platform.restaurant')}</TableHead>}
                  <TableHead>{t('platform.invoice')}</TableHead>
                  <TableHead>{t('platform.period')}</TableHead>
                  <TableHead>{t('platform.issuedAt')}</TableHead>
                  <TableHead>{t('platform.total')}</TableHead>
                  <TableHead>{t('platform.payment')}</TableHead>
                  <TableHead>{t('platform.status')}</TableHead>
                  <TableHead>
                    <span className="sr-only">PDF</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const reviewReason = reviewReasonLabel(invoice.reviewReason, locale)
                  return (
                    <TableRow key={invoice.id}>
                      {showTenant && <TableCell>{invoice.tenantName}</TableCell>}
                      <TableCell className="font-medium">
                        {invoice.fullNumber ?? t('platform.unnumbered')}
                      </TableCell>
                      <TableCell>
                        {invoice.periodStart} — {invoice.periodEnd}
                      </TableCell>
                      <TableCell>{formatDate(invoice.issuedAt, locale)}</TableCell>
                      <TableCell>{formatMoney(invoice.totalCents, locale)}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div>{paymentStatusLabel(invoice.paymentStatus, locale)}</div>
                          {invoice.paymentStatus === 'paid' && (
                            <div className="text-muted-foreground text-xs">
                              {formatDate(invoice.paidAt, locale)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {statusLabel(invoice.status, locale)}
                        {reviewReason ? ` · ${reviewReason}` : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        <InvoicePdfButton invoice={invoice} locale={locale} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
