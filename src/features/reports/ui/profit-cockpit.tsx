import { Card, CardContent, CardHeader, CardTitle, MetricCard } from '@doscientos/ui'
import { AlertTriangle, CheckCircle2, Euro, Scale } from 'lucide-react'

import { decideRecommendation, explainProfitability } from '@/features/ai-operations'

import type { getSalesReport } from '../application/reports'

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
  const euro = (cents: number) => `${(cents / 100).toFixed(2)} €`
  const confidence = { high: 'Alta', medium: 'Media', low: 'Baja' }[profit.confidence]
  const insight = explainProfitability({
    period: `${profit.period.from} – ${profit.period.to}`,
    salesCents: profit.netSalesCents,
    marginPercent: profit.netSalesCents
      ? (profit.estimatedContributionCents / profit.netSalesCents) * 100
      : 0,
    foodCostCents: profit.foodCostCents,
    wasteCostCents: profit.wasteCostCents,
    laborCostCents: profit.laborCostCents,
    laborCostAvailable: profit.laborCostAvailable,
  })
  return (
    <section aria-labelledby="profit-cockpit-title" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold" id="profit-cockpit-title">
          Profit Cockpit
        </h2>
        <p className="text-muted-foreground text-sm">
          Dónde estás ganando y dónde se está escapando el margen.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <CardHeader>
          <CardTitle>Prioridades económicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
                    <span className="mt-2 flex gap-2">
                      {(['accepted', 'snoozed'] as const).map((status) => (
                        <button
                          className="rounded border px-2 py-1 text-xs"
                          key={status}
                          onClick={() =>
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
                            })
                          }
                          type="button"
                        >
                          {status === 'accepted' ? 'Aceptar' : 'Posponer'}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lectura de dirección</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{insight.answer}</p>
          <p className="text-muted-foreground text-xs">
            Confianza: {insight.confidence}. Fuentes: {insight.sources.join(', ')}.
          </p>
          <ul className="list-disc pl-5 text-sm">
            {insight.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
