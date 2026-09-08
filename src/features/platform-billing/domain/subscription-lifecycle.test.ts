import { describe, expect, it } from 'vitest'

import {
  subscriptionActionAfterPaymentFailure,
  tenantStatusAfterSuccessfulPayment,
} from './subscription-lifecycle'

describe('subscription payment lifecycle', () => {
  it('keeps the tenant active during the fifteen calendar-day grace period', () => {
    expect(
      subscriptionActionAfterPaymentFailure({
        failedOn: new Date('2026-09-01T00:00:00.000Z'),
        today: new Date('2026-09-15T23:59:59.999Z'),
      }),
    ).toBe('mark_past_due')
  })

  it('suspends on the fifteenth day after the failed charge', () => {
    expect(
      subscriptionActionAfterPaymentFailure({
        failedOn: new Date('2026-09-01T00:00:00.000Z'),
        today: new Date('2026-09-16T00:00:00.000Z'),
      }),
    ).toBe('suspend')
  })

  it('restores an operational tenant after a confirmed payment', () => {
    expect(tenantStatusAfterSuccessfulPayment()).toBe('active')
  })
})