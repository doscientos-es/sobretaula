export type ProfitabilityConfidence = 'high' | 'medium' | 'low'

export interface ProfitabilityInput {
  grossCents: number
  refundedCents: number
  discountsCents: number
  foodCostCents: number
  wasteCostCents: number
  laborCostCents: number
  laborCostAvailable: boolean
  wasteMovements: number
  dataFrom: string
  dataTo: string
}

export function calculateProfitability(input: ProfitabilityInput) {
  const netSalesCents = Math.max(0, input.grossCents - input.refundedCents - input.discountsCents)
  const totalCostCents =
    input.foodCostCents +
    input.wasteCostCents +
    (input.laborCostAvailable ? input.laborCostCents : 0)
  const confidence: ProfitabilityConfidence = input.laborCostAvailable
    ? 'high'
    : totalCostCents > 0
      ? 'medium'
      : 'low'
  const percent = (value: number) => (netSalesCents ? (value / netSalesCents) * 100 : 0)
  const recommendations: { kind: string; title: string; detail: string }[] = []
  if (input.wasteCostCents > 0)
    recommendations.push({
      kind: 'waste',
      title: 'Revisa las mermas del periodo',
      detail: `${input.wasteMovements} movimientos de merma han supuesto ${(input.wasteCostCents / 100).toFixed(2)} €. `,
    })
  if (percent(input.foodCostCents) > 32)
    recommendations.push({
      kind: 'food_cost',
      title: 'El coste de materia prima está elevado',
      detail: `Representa el ${percent(input.foodCostCents).toFixed(1)}% de las ventas netas.`,
    })
  if (!input.laborCostAvailable)
    recommendations.push({
      kind: 'labor_data',
      title: 'Completa los costes laborales',
      detail: 'Configura costes horarios para calcular el prime cost completo.',
    })
  if (!recommendations.length)
    recommendations.push({
      kind: 'healthy',
      title: 'No hay alertas económicas críticas',
      detail: 'Sigue registrando compras y mermas para mantener la precisión.',
    })
  return {
    netSalesCents,
    foodCostCents: input.foodCostCents,
    wasteCostCents: input.wasteCostCents,
    laborCostCents: input.laborCostCents,
    laborCostAvailable: input.laborCostAvailable,
    totalCostCents,
    estimatedContributionCents: netSalesCents - totalCostCents,
    foodCostPercent: percent(input.foodCostCents),
    wasteCostPercent: percent(input.wasteCostCents),
    laborCostPercent: percent(input.laborCostCents),
    confidence,
    period: { from: input.dataFrom, to: input.dataTo },
    recommendations,
  }
}
