export const PAYMENT_GRACE_DAYS = 15

export type TenantSubscriptionAction = 'keep_active' | 'mark_past_due' | 'suspend'

/** Determines the action for a failed payment without performing persistence. */
export function subscriptionActionAfterPaymentFailure({
  failedOn,
  graceDays = PAYMENT_GRACE_DAYS,
  today,
}: {
  failedOn: Date
  graceDays?: number
  today: Date
}): TenantSubscriptionAction {
  if (!Number.isSafeInteger(graceDays) || graceDays < 1) throw new Error('invalid_grace_days')
  const graceEndsAt = new Date(failedOn)
  graceEndsAt.setUTCDate(graceEndsAt.getUTCDate() + graceDays)
  if (today.getTime() >= graceEndsAt.getTime()) return 'suspend'
  return 'mark_past_due'
}

/** A confirmed payment always restores the tenant without losing operational data. */
export function tenantStatusAfterSuccessfulPayment(): 'active' {
  return 'active'
}
