import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { useState } from 'react'

import type { getSalesReport } from '../application/reports'

const initialDateRange = {
  from: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
}

export function SalesReportPage({
  report: initialReport,
  onRange: loadRange,
}: {
  report: Awaited<ReturnType<typeof getSalesReport>>
  onRange: (from: string, to: string) => Promise<Awaited<ReturnType<typeof getSalesReport>>>
}) {
  const [report, setReport] = useState(initialReport)
  const [from, setFrom] = useState(initialDateRange.from)
  const [to, setTo] = useState(initialDateRange.to)
  const onRange = (fromValue: string, toValue: string) =>
    void loadRange(fromValue, toValue).then(setReport)
  const euro = (cents: number) => `${(cents / 100).toFixed(2)} €`
  return (
    <section className="space-y-6">
      <PageHeader>
        <div>
          <PageHeaderTitle>Informes de ventas</PageHeaderTitle>
          <PageHeaderDescription>
            Ventas, impuestos y métodos de pago del local.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Field>
            <FieldLabel htmlFor="report-from">Desde</FieldLabel>
            <Input
              id="report-from"
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              value={from}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="report-to">Hasta</FieldLabel>
            <Input id="report-to" onChange={(e) => setTo(e.target.value)} type="date" value={to} />
          </Field>
          <button
            className="border-input h-10 rounded-md border px-3 text-sm"
            onClick={() => onRange(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`)}
            type="button"
          >
            Actualizar
          </button>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ventas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{euro(report.grossCents)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>IVA</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{euro(report.vatCents)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ticket medio</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {euro(report.ticketAverageCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Propinas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {euro(report.financial.totalTipsCents)}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ventas por método</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {Object.entries(report.byMethod).map(([method, amount]) => (
              <li className="flex justify-between" key={method}>
                <span>{method}</span>
                <span>{euro(amount)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Conciliación y cierres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            {report.financial.closedRegisters.length} cierres ·{' '}
            {report.financial.mixedPaymentBatches} pagos mixtos ·{' '}
            {report.financial.reconciliations.length} arqueos registrados
          </p>
          {report.financial.reconciliations.length > 0 && (
            <ul className="space-y-1">
              {report.financial.reconciliations.slice(0, 10).map((entry) => (
                <li className="flex justify-between" key={entry.id as string}>
                  <span>{new Date(entry.reconciled_at as string).toLocaleString('es-ES')}</span>
                  <span className="tabular-nums">{euro(entry.variance_cents as number)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
