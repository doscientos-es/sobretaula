import {
  Button,
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
import { useRef, useState } from 'react'

import { zonedDateKey, zonedDayBounds } from '@/shared/lib/date/zoned-time'

import type { getSalesReport } from '../application/reports'

export function SalesReportPage({
  initialPeriod,
  report: initialReport,
  timeZone,
  onRange: loadRange,
}: {
  initialPeriod: { from: string; to: string }
  report: Awaited<ReturnType<typeof getSalesReport>>
  timeZone: string
  onRange: (from: string, to: string) => Promise<Awaited<ReturnType<typeof getSalesReport>>>
}) {
  const [report, setReport] = useState(initialReport)
  const [from, setFrom] = useState(zonedDateKey(new Date(initialPeriod.from), timeZone))
  const [to, setTo] = useState(
    zonedDateKey(new Date(new Date(initialPeriod.to).getTime() - 1), timeZone),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const onRange = (fromValue: string, toValue: string) => {
    if (!fromValue || !toValue || fromValue > toValue) {
      setError('Selecciona un rango válido: la fecha inicial debe ser anterior o igual a la final.')
      return
    }
    const version = ++requestVersion.current
    setLoading(true)
    setError(null)
    void loadRange(
      zonedDayBounds(fromValue, timeZone).dayStartIso,
      zonedDayBounds(toValue, timeZone).dayEndIso,
    )
      .then((nextReport) => {
        if (version === requestVersion.current) setReport(nextReport)
      })
      .catch(() => {
        if (version === requestVersion.current)
          setError('No se ha podido cargar el informe. Inténtalo de nuevo.')
      })
      .finally(() => {
        if (version === requestVersion.current) setLoading(false)
      })
  }
  const euro = (cents: number) => `${(cents / 100).toFixed(2)} €`
  return (
    <section className="space-y-4">
      <PageHeader>
        <div>
          <PageHeaderTitle>Informes de ventas</PageHeaderTitle>
          <PageHeaderDescription>
            Ventas, impuestos y métodos de pago del local.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 py-3">
          <Field className="min-w-36">
            <FieldLabel className="text-xs" htmlFor="report-from">
              Desde
            </FieldLabel>
            <Input
              className="h-9"
              id="report-from"
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              value={from}
            />
          </Field>
          <Field className="min-w-36">
            <FieldLabel className="text-xs" htmlFor="report-to">
              Hasta
            </FieldLabel>
            <Input
              className="h-9"
              id="report-to"
              onChange={(e) => setTo(e.target.value)}
              type="date"
              value={to}
            />
          </Field>
          <Button
            disabled={loading}
            onClick={() => onRange(from, to)}
            size="sm"
            type="button"
            variant="outline"
          >
            {loading ? 'Cargando…' : 'Actualizar'}
          </Button>
        </CardContent>
      </Card>
      {error && (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          <span>{error}</span>
          <Button onClick={() => onRange(from, to)} size="sm" type="button" variant="outline">
            Reintentar
          </Button>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>Ventas</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-xl font-semibold">
            {euro(report.grossCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>IVA</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-xl font-semibold">
            {euro(report.vatCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>Ticket medio</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-xl font-semibold">
            {euro(report.ticketAverageCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>Propinas</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-xl font-semibold">
            {euro(report.financial.totalTipsCents)}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle>Ventas por método</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ul className="space-y-2 text-sm">
            {Object.entries(report.byMethod).length > 0 ? (
              Object.entries(report.byMethod).map(([method, amount]) => (
                <li className="flex justify-between" key={method}>
                  <span>{method}</span>
                  <span>{euro(amount)}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No hay ventas por método en este periodo.</li>
            )}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle>Conciliación y cierres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 text-sm">
          <p>
            {report.financial.closedRegisters.length} cierres ·{' '}
            {report.financial.mixedPaymentBatches} pagos mixtos ·{' '}
            {report.financial.reconciliations.length} arqueos registrados
          </p>
          {report.financial.reconciliations.length > 0 && (
            <ul className="space-y-1">
              {report.financial.reconciliations.slice(0, 10).map((entry) => (
                <li className="flex justify-between" key={entry.id as string}>
                  <span>
                    {new Date(entry.reconciled_at as string).toLocaleString('es-ES', {
                      timeZone,
                    })}
                  </span>
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
