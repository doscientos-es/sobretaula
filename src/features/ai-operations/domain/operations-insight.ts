export interface OperationsInsightInput {
  period: string
  salesCents: number
  marginPercent: number
  foodCostCents: number
  wasteCostCents: number
  laborCostCents: number | null
  laborCostAvailable: boolean
}
export interface OperationsInsight {
  answer: string
  period: string
  confidence: 'high' | 'medium' | 'low'
  sources: string[]
  actions: string[]
}
export function explainProfitability(input: OperationsInsightInput): OperationsInsight {
  const causes: string[] = []
  if (input.foodCostCents > input.salesCents * 0.3)
    causes.push(`coste de producto de ${(input.foodCostCents / 100).toFixed(2)} €`)
  if (input.wasteCostCents > 0)
    causes.push(`mermas de ${(input.wasteCostCents / 100).toFixed(2)} €`)
  if (
    input.laborCostAvailable &&
    input.laborCostCents &&
    input.laborCostCents > input.salesCents * 0.35
  )
    causes.push(`coste laboral de ${(input.laborCostCents / 100).toFixed(2)} €`)
  const answer = causes.length
    ? `El margen del periodo es del ${input.marginPercent.toFixed(1)}%. Los principales factores detectados son ${causes.join(', ')}.`
    : `El margen del periodo es del ${input.marginPercent.toFixed(1)}% y no se detectan desviaciones principales con los datos disponibles.`
  return {
    answer,
    period: input.period,
    confidence: input.laborCostAvailable ? 'high' : 'medium',
    sources: [
      'Profit Cockpit',
      'ventas',
      'inventario',
      ...(input.laborCostAvailable ? ['fichajes y tarifas'] : []),
    ],
    actions: causes.length
      ? [
          'Revisar compras y escandallos',
          'Analizar mermas por motivo',
          ...(input.laborCostAvailable ? ['Revisar horas previstas frente a reales'] : []),
        ]
      : ['Mantener seguimiento semanal'],
  }
}

export function answerOperationsQuestion(
  question: string,
  input: OperationsInsightInput,
): OperationsInsight {
  const insight = explainProfitability(input)
  const normalized = question.trim().toLowerCase()
  return normalized.includes('ganado') || normalized.includes('margen') || !normalized
    ? insight
    : {
        ...insight,
        answer: `Puedo responder sobre rentabilidad, costes, mermas y personal. ${insight.answer}`,
      }
}
