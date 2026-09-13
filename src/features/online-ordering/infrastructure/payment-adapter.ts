export interface OnlinePaymentIntent {
  orderId: string
  amountCents: number
  currency: 'EUR'
  checkoutUrl: string
  provider: string
}

export interface OnlinePaymentAdapter {
  createPaymentIntent(input: {
    orderId: string
    amountCents: number
    customerEmail?: string
  }): Promise<OnlinePaymentIntent>
}

export function validatePaymentIntent(
  intent: OnlinePaymentIntent,
  expectedAmountCents: number,
): boolean {
  return (
    intent.amountCents === expectedAmountCents &&
    intent.currency === 'EUR' &&
    intent.orderId.length > 0 &&
    intent.checkoutUrl.length > 0
  )
}
