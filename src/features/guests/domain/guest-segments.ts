export type GuestSegment = 'vip' | 'habitual' | 'inactivo' | 'nuevo'
export function classifyGuest(input: {
  visits: number
  spendCents: number
  daysSinceLastVisit: number
}): GuestSegment {
  if (input.daysSinceLastVisit > 90 && input.visits > 0) return 'inactivo'
  if (input.spendCents >= 100000 || input.visits >= 12) return 'vip'
  if (input.visits >= 3) return 'habitual'
  return 'nuevo'
}
