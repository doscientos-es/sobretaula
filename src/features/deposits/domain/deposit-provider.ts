export interface DepositIntent {
  provider: string
  reference: string
  checkoutUrl: string | null
}
export interface DepositProvider {
  createIntent(input: {
    amountCents: number
    currency: string
    idempotencyKey: string
  }): Promise<DepositIntent>
}

export function validateDepositAmount(amountCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('invalid_deposit_amount')
}
