import { Card, CardContent, CardHeader, CardTitle, MetricCard } from '@doscientos/ui'
import { AlertTriangle, CheckCircle2, Euro, Scale } from 'lucide-react'
import { useState } from 'react'

import {
  answerOperationsQuestion,
  decideRecommendation,
  explainProfitability,
  type listRecommendationDecisions,
} from '@/features/ai-operations'
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
  const [question, setQuestion] = useState('')
  const [questionAnswer, setQuestionAnswer] = useState(insight)
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
    <section aria-labelledby="profit-cockpit-title" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold" id="profit-cockpit-title">
          Profit Cockpit
        </h2>
        <p className="text-muted-foreground text-sm">
          Dónde estás ganando y dónde se está escapando el margen.
        </p>
        {tenantId && venueId ? (
          <button
            className="mt-2 rounded-md border px-3 py-2 text-sm"
            onClick={() => void downloadCsv()}
            type="button"
          >
            Descargar CSV para gestoría
          </button>
        ) : null}
      </div>
      {decisions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Decisiones recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
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
                      {(['accepted', 'ignored', 'snoozed'] as const).map((status) => (
                        <button
                          className="rounded border px-2 py-1 text-xs"
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
                          type="button"
                        >
                          {status === 'accepted'
                            ? 'Aceptar'
                            : status === 'ignored'
                              ? 'Ignorar'
                              : 'Posponer'}
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
          <div className="flex gap-2">
            <input
              aria-label="Pregunta sobre el periodo"
              className="border-input min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="¿Por qué ha bajado el margen?"
              value={question}
            />
            <button
              className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
              onClick={() =>
                setQuestionAnswer(
                  answerOperationsQuestion(question, {
                    period: `${profit.period.from} – ${profit.period.to}`,
                    salesCents: profit.netSalesCents,
                    marginPercent: profit.netSalesCents
                      ? (profit.estimatedContributionCents / profit.netSalesCents) * 100
                      : 0,
                    foodCostCents: profit.foodCostCents,
                    wasteCostCents: profit.wasteCostCents,
                    laborCostCents: profit.laborCostCents,
                    laborCostAvailable: profit.laborCostAvailable,
                  }),
                )
              }
              type="button"
            >
              Consultar
            </button>
          </div>
          <p className="text-sm">{questionAnswer.answer}</p>
          <p className="text-muted-foreground text-xs">
            Periodo: {questionAnswer.period} · Confianza: {questionAnswer.confidence}. Fuentes:{' '}
            {questionAnswer.sources.join(', ')}.
          </p>
          <ul className="list-disc pl-5 text-sm">
            {questionAnswer.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
