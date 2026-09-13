export interface ForecastDay {
  date: string
  covers: number
  salesCents: number
}

export interface DemandForecast {
  expectedCovers: number
  expectedSalesCents: number
  confidence: 'high' | 'medium' | 'low'
  sources: string[]
  ingredientDemand: Record<string, number>
}

/** Conservative forecast: historical same-day observations plus confirmed covers. */
export function forecastDemand(
  history: readonly ForecastDay[],
  upcomingReservations: number,
  reservationAverageSpendCents = 0,
  ingredientDemand: Record<string, number> = {},
): DemandForecast {
  const observations = history.filter((day) => day.covers > 0 || day.salesCents > 0)
  const averageCovers = observations.length
    ? observations.reduce((sum, day) => sum + day.covers, 0) / observations.length
    : 0
  const averageSales = observations.length
    ? observations.reduce((sum, day) => sum + day.salesCents, 0) / observations.length
    : 0
  const expectedCovers = Math.max(Math.ceil(averageCovers), upcomingReservations)
  const reservationSales = upcomingReservations * reservationAverageSpendCents
  const expectedSalesCents = Math.max(Math.round(averageSales), Math.round(reservationSales))
  return {
    expectedCovers,
    expectedSalesCents,
    confidence: observations.length >= 4 ? 'high' : observations.length >= 2 ? 'medium' : 'low',
    sources: [
      ...(observations.length ? [`${observations.length} servicios históricos`] : []),
      ...(upcomingReservations ? [`${upcomingReservations} cubiertos reservados`] : []),
    ],
    ingredientDemand,
  }
}

export function forecastIngredientDemand(
  historicalCovers: number,
  soldRecipes: readonly { ingredientId: string; quantity: number }[],
  expectedCovers: number,
) {
  if (historicalCovers <= 0) return {}
  const usage: Record<string, number> = {}
  for (const line of soldRecipes)
    usage[line.ingredientId] = (usage[line.ingredientId] ?? 0) + line.quantity
  return Object.fromEntries(
    Object.entries(usage).map(([ingredientId, quantity]) => [
      ingredientId,
      (quantity / historicalCovers) * expectedCovers,
    ]),
  )
}
