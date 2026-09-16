import { Button, Card, CardContent, CardHeader, CardTitle, MetricCard } from '@doscientos/ui'
import { AlertTriangle, CheckCircle2, Euro, Scale } from 'lucide-react'
import { useState } from 'react'

import { exportSalesReportCsv, type getSalesReport } from '../application/reports'

export function ProfitCockpit({
  report,
  tenantId,
  venueId,
}: {
  report: Awaited<ReturnType<typeof getSalesReport>>
  tenantId?: string
  venueId?: string
}) {
  const profit = report.profitability
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const euro = (cents: number) => `${(cents / 100).toFixed(2)} €`
  const confidence = { high: 'Alta', medium: 'Media', low: 'Baja' }[profit.confidence]
  async function downloadCsv() {
    if (exporting || !tenantId || !venueId) return
    setExporting(true)
    setExportMessage(null)
    try {
      const csv = await exportSalesReportCsv({
        data: { tenantId, venueId, from: profit.period.from, to: profit.period.to },
      })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      link.download = `sobretaula-informe-${profit.period.from.slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
      setExportMessage('CSV descargado.')
    } catch {
      setExportMessage('No se ha podido descargar el CSV. Inténtalo de nuevo.')
    } finally {
      setExporting(false)
    }
  }
  return (
    <section aria-labelledby="profit-cockpit-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold" id="profit-cockpit-title">
            Rentabilidad
          </h2>
          <p className="text-muted-foreground text-sm">
            Dónde estás ganando y dónde se está escapando el margen.
          </p>
        </div>
        {tenantId && venueId ? (
          <Button
            disabled={exporting}
            onClick={() => void downloadCsv()}
            size="sm"
            type="button"
            variant="outline"
          >
            {exporting ? 'Preparando CSV…' : 'Descargar CSV para gestoría'}
          </Button>
        ) : null}
      </div>
      {exportMessage ? (
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {exportMessage}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          description="Ventas netas del periodo"
          icon={<Euro />}
          label="Ventas netas"
          tone="success"
          value={euro(profit.netSalesCents)}
        />
        <MetricCard
          description={`${profit.foodCostPercent.toFixed(1)}% de las ventas`}
          icon={<Scale />}
          label="Coste de producto"
          value={euro(profit.foodCostCents)}
        />
        <MetricCard
          description={`${profit.wasteCostPercent.toFixed(1)}% de las ventas`}
          icon={<AlertTriangle />}
          label="Coste de merma"
          tone={profit.wasteCostCents > 0 ? 'warning' : 'default'}
          value={euro(profit.wasteCostCents)}
        />
        <MetricCard
          description={
            profit.laborCostAvailable
              ? `${profit.laborCostPercent.toFixed(1)}% de las ventas`
              : 'Dato pendiente'
          }
          icon={<Scale />}
          label="Aportación estimada"
          tone="info"
          value={euro(profit.estimatedContributionCents)}
        />
      </div>
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle>Prioridades económicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <p className="text-muted-foreground text-xs">
            Confianza del cálculo: {confidence}. El periodo y los costes usados son trazables en el
            informe.
          </p>
          <ul className="space-y-3">
            {profit.recommendations.map((recommendation) => (
              <li className="flex gap-3 text-sm" key={recommendation.kind}>
                {recommendation.kind === 'healthy' ? (
                  <CheckCircle2 className="text-success mt-0.5 size-4" />
                ) : (
                  <AlertTriangle className="text-warning mt-0.5 size-4" />
                )}
                <span>
                  <strong>{recommendation.title}</strong>
                  <br />
                  <span className="text-muted-foreground">{recommendation.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
