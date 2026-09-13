export type OnlinePaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded'
export function canAcceptOnlineOrder(paymentStatus: OnlinePaymentStatus): boolean {
  return paymentStatus === 'paid' || paymentStatus === 'authorized'
}
