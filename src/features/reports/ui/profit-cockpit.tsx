import { Button, Card, CardContent, CardHeader, CardTitle, MetricCard } from '@doscientos/ui'
import { AlertTriangle, CheckCircle2, Euro, Scale } from 'lucide-react'

import { decideRecommendation, type listRecommendationDecisions } from '@/features/ai-operations'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import { exportSalesReportCsv, type getSalesReport } from '../application/reports'

export function ProfitCockpit({
  report,
  tenantId,
  venueId,
  recommendationHistory,
}: {
  report: Awaited<ReturnType<typeof getSalesReport>>
  tenantId?: string
  venueId?: string
  recommendationHistory?:
    | Awaited<ReturnType<typeof listRecommendationDecisions>>
    | Awaited<ReturnType<typeof listRecommendationDecisions>>['items']
}) {
  const profit = report.profitability
  const reload = useLoaderReload()
  const euro = (cents: number) => `${(cents / 100).toFixed(2)} €`
  const confidence = { high: 'Alta', medium: 'Media', low: 'Baja' }[profit.confidence]
  const decisions = Array.isArray(recommendationHistory)
    ? recommendationHistory
    : (recommendationHistory?.items ?? [])
  async function downloadCsv() {
    if (!tenantId || !venueId) return
    const csv = await exportSalesReportCsv({
      data: { tenantId, venueId, from: profit.period.from, to: profit.period.to },
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `sobretaula-informe-${profit.period.from.slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
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
          <Button onClick={() => void downloadCsv()} size="sm" type="button" variant="outline">
            Descargar CSV para gestoría
          </Button>
        ) : null}
      </div>
      {decisions.length ? (
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>Decisiones recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4 text-sm">
            {decisions.map((decision) => (
              <div
                className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0"
                key={decision.id}
              >
                <span>
                  <strong>{decision.title}</strong>
                  <span className="text-muted-foreground ml-2">{decision.detail}</span>
                </span>
                <span className="font-medium">
                  {decision.status === 'accepted'
                    ? 'Aceptada'
                    : decision.status === 'ignored'
                      ? 'Ignorada'
                      : 'Pospuesta'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
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
                  {tenantId && venueId && recommendation.kind !== 'healthy' && (
                    <span className="mt-2 flex flex-wrap gap-2">
                      {(['accepted', 'ignored', 'snoozed'] as const).map((status) => (
                        <Button
                          key={status}
                          onClick={() => {
                            void decideRecommendation({
                              data: {
                                tenantId,
                                venueId,
                                kind: recommendation.kind,
                                title: recommendation.title,
                                detail: recommendation.detail,
                                periodFrom: profit.period.from,
                                periodTo: profit.period.to,
                                source: ['Profit Cockpit'],
                                status,
                              },
                            }).then(() => reload())
                          }}
                          size="xs"
                          type="button"
                          variant={status === 'accepted' ? 'default' : 'outline'}
                        >
                          {status === 'accepted'
                            ? 'Aceptar'
                            : status === 'ignored'
                              ? 'Ignorar'
                              : 'Posponer'}
                        </Button>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
