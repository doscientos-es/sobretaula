export type RecommendationStatus = 'pending' | 'accepted' | 'ignored' | 'snoozed'
export function canChangeRecommendationStatus(
  current: RecommendationStatus,
  next: RecommendationStatus,
): boolean {
  return current === 'pending' || current === next
}
