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
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Documentos emitidos por la plataforma a sus restaurantes.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <section aria-label={title}>
          <Table className="min-w-[680px] text-left">
            <TableHeader className="text-muted-foreground">
              <TableRow>
                {showTenant && <TableHead>Restaurante</TableHead>}
                <TableHead>Factura</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  {showTenant && <TableCell>{invoice.tenantName}</TableCell>}
                  <TableCell className="font-medium">
                    {invoice.fullNumber ?? 'Sin numerar'}
                  </TableCell>
                  <TableCell>
                    {invoice.periodStart} — {invoice.periodEnd}
                  </TableCell>
                  <TableCell>{formatMoney(invoice.totalCents, locale)}</TableCell>
                  <TableCell>
                    {statusLabel(invoice.status)}
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
