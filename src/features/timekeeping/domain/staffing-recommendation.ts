export interface StaffingRecommendationInput {
  expectedCovers: number
  currentStaff: number
  coversPerStaff: number
  minimumStaff: number
}
export interface StaffingRecommendation {
  recommendedStaff: number
  delta: number
  confidence: 'high' | 'medium' | 'low'
  reason: string
}
export function recommendStaffing(input: StaffingRecommendationInput): StaffingRecommendation {
  const recommendedStaff = Math.max(
    input.minimumStaff,
    Math.ceil(Math.max(0, input.expectedCovers) / Math.max(1, input.coversPerStaff)),
  )
  const delta = recommendedStaff - input.currentStaff
  const reason =
    delta > 0
      ? `Para ${input.expectedCovers} cubiertos recomendamos ${recommendedStaff} personas.`
      : delta < 0
        ? `Con ${input.expectedCovers} cubiertos bastan ${recommendedStaff} personas.`
        : `La plantilla actual de ${input.currentStaff} personas encaja con la previsión.`
  return {
    recommendedStaff,
    delta,
    confidence: input.expectedCovers > 0 ? 'medium' : 'low',
    reason,
  }
}
