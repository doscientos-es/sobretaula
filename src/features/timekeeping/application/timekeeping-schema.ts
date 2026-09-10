import { z } from 'zod'

import { TIME_EVENT_TYPES } from '../domain/timekeeping'
export const timekeepingInput = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
})
export const recordTimeEventInput = timekeepingInput.extend({
  eventType: z.enum(TIME_EVENT_TYPES),
  terminalId: z.string().trim().max(100).optional(),
})
export const timekeepingReportInput = timekeepingInput.extend({
  from: z.string().datetime(),
  to: z.string().datetime(),
})
export const setPinInput = timekeepingInput.extend({ pin: z.string().regex(/^\d{4,8}$/) })
export const verifyPinInput = timekeepingInput.extend({
  employeeId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,8}$/),
})
export const terminalTimeEventInput = verifyPinInput.extend({
  eventType: z.enum(TIME_EVENT_TYPES),
  terminalId: z.string().trim().max(100).optional(),
})
