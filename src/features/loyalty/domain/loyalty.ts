export interface LoyaltyAccount {
  guestId: string
  points: number
  lifetimePoints: number
}

export function pointsForSpend(amountCents: number, centsPerPoint = 100): number {
  if (!Number.isInteger(amountCents) || amountCents < 0 || centsPerPoint <= 0) return 0
  return Math.floor(amountCents / centsPerPoint)
}

export function canRedeem(points: number, cost: number): boolean {
  return Number.isInteger(points) && Number.isInteger(cost) && points >= cost && cost > 0
}
