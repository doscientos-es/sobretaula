export type VerifiedPaymentStatus = 'authorized' | 'paid' | 'failed' | 'refunded'

export function isPaymentAmountValid(
  status: VerifiedPaymentStatus,
  orderTotalCents: number,
  paymentAmountCents: number,
): boolean {
  return (
    Number.isInteger(orderTotalCents) &&
    Number.isInteger(paymentAmountCents) &&
    orderTotalCents >= 0 &&
    paymentAmountCents >= 0 &&
    (!['authorized', 'paid'].includes(status) || orderTotalCents === paymentAmountCents)
  )
}
export function paymentWebhookStatus(responseCode: string): VerifiedPaymentStatus {
  return responseCode === '0000' ? 'paid' : responseCode.startsWith('00') ? 'authorized' : 'failed'
}
