export function normalizeGiftCardCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

export function canRedeemGiftCard(balanceCents: number, amountCents: number): boolean {
  return (
    Number.isInteger(balanceCents) &&
    Number.isInteger(amountCents) &&
    balanceCents >= amountCents &&
    amountCents > 0
  )
}
