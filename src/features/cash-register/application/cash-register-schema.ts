import { z } from 'zod'

import { CASH_MOVEMENT_KINDS } from '../domain/cash-register'

export const venueCashInput = z.object({ tenantId: z.string().uuid(), venueId: z.string().uuid() })
export const openCashRegisterInput = venueCashInput.extend({
  openingFloatCents: z.number().int().min(0).max(10_000_000),
})
export const addCashMovementInput = venueCashInput.extend({
  registerId: z.string().uuid(),
  kind: z.enum(CASH_MOVEMENT_KINDS),
  amountCents: z.number().int().min(1).max(10_000_000),
  reason: z.string().trim().min(2).max(200),
})
export const closeCashRegisterInput = venueCashInput.extend({
  registerId: z.string().uuid(),
  countedCashCents: z.number().int().min(0).max(10_000_000),
})
