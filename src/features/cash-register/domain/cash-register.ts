export const CASH_MOVEMENT_KINDS = ['in', 'out'] as const
export type CashMovementKind = (typeof CASH_MOVEMENT_KINDS)[number]

export interface CashMovement { kind: CashMovementKind; amountCents: number }

export function expectedCashCents(openingFloatCents: number, movements: readonly CashMovement[], cashSalesCents: number): number {
  return openingFloatCents + cashSalesCents + movements.reduce((total, movement) => total + (movement.kind === 'in' ? movement.amountCents : -movement.amountCents), 0)
}

export function cashDifferenceCents(expectedCents: number, countedCents: number): number {
  return countedCents - expectedCents
}
