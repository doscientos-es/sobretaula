import {
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
  PageHeader,
  PageHeaderTitle,
} from '@doscientos/ui'

import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'
import { formatMoney } from '@/shared/lib/money/money'

import { formatInvoiceReference, type Invoice } from '../domain/invoice'

export function InvoiceListPage({
  invoices,
  locale,
}: {
  invoices: readonly Invoice[]
  locale: Locale
}) {
  const t = createTranslator(locale)

  return (
    <section className="space-y-4">
      <PageHeader>
        <PageHeaderTitle>{t('invoices.title')}</PageHeaderTitle>
      </PageHeader>
      <p className="text-muted-foreground text-xs">{t('invoices.env.test')}</p>
      {invoices.length === 0 ? (
        <DataViewState>
          <DataViewStateTitle>{t('invoices.title')}</DataViewStateTitle>
          <DataViewStateDescription>{t('invoices.empty')}</DataViewStateDescription>
        </DataViewState>
      ) : (
        <ul className="divide-border divide-y text-sm">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex items-center justify-between py-2">
              <span>{formatInvoiceReference(invoice.series, invoice.number)}</span>
              <span>{formatMoney(invoice.totalGross, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
