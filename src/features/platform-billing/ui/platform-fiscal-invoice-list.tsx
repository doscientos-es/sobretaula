import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
} from '@doscientos/ui'

import type { Locale } from '@/shared/lib/i18n/locale'
import { formatMoney } from '@/shared/lib/money/money'

import type { PlatformFiscalInvoice } from '../application/get-platform-fiscal-invoices'

function statusLabel(status: PlatformFiscalInvoice['status']): string {
  return { issued: 'Emitida', pending_review: 'Pendiente de revisión', registered: 'Registrada' }[
    status
  ]
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
  if (invoices.length === 0) {
    return (
      <DataViewState>
        <DataViewStateTitle>{title}</DataViewStateTitle>
        <DataViewStateDescription>
          Aún no hay facturas de suscripción para mostrar.
        </DataViewStateDescription>
      </DataViewState>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Documentos emitidos por la plataforma a sus restaurantes.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <section aria-label={title}>
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                {showTenant && <th className="px-3 py-3 font-medium">Restaurante</th>}
                <th className="px-3 py-3 font-medium">Factura</th>
                <th className="px-3 py-3 font-medium">Periodo</th>
                <th className="px-3 py-3 font-medium">Total</th>
                <th className="px-3 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr className="border-b last:border-0" key={invoice.id}>
                  {showTenant && <td className="px-3 py-3">{invoice.tenantName}</td>}
                  <td className="px-3 py-3 font-medium">{invoice.fullNumber ?? 'Sin numerar'}</td>
                  <td className="px-3 py-3">
                    {invoice.periodStart} — {invoice.periodEnd}
                  </td>
                  <td className="px-3 py-3">{formatMoney(invoice.totalCents, locale)}</td>
                  <td className="px-3 py-3">
                    {statusLabel(invoice.status)}
                    {invoice.reviewReason ? ` · ${invoice.reviewReason}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </CardContent>
    </Card>
  )
}
