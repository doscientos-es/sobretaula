import {
  Card,
  CardContent,
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
  PageHeader,
  PageHeaderDescription,
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
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{t('invoices.title')}</PageHeaderTitle>
          <PageHeaderDescription>
            Documentos emitidos desde las cuentas cerradas del restaurante.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <p className="text-muted-foreground text-xs">{t('invoices.env.test')}</p>
      {invoices.length === 0 ? (
        <DataViewState>
          <DataViewStateTitle>{t('invoices.title')}</DataViewStateTitle>
          <DataViewStateDescription>{t('invoices.empty')}</DataViewStateDescription>
        </DataViewState>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-border divide-y text-sm">
              {invoices.map((invoice) => (
                <li className="flex items-center justify-between gap-4 px-5 py-4" key={invoice.id}>
                  <span className="font-medium">
                    {formatInvoiceReference(invoice.series, invoice.number)}
                  </span>
                  <span className="tabular-nums">{formatMoney(invoice.totalGross, locale)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
