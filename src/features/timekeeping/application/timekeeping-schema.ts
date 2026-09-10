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
  terminalId: z.string().trim().min(1).max(100),
})
export const timekeepingTermInput = timekeepingInput.extend({
  dailyTargetMinutes: z.number().int().min(1).max(960),
  effectiveFrom: z.string().date(),
  employeeId: z.string().uuid(),
  employmentType: z.enum(['full_time', 'part_time']),
  minimumBreakMinutes: z.number().int().min(0).max(180),
  minimumDailyRestMinutes: z.number().int().min(0).max(1440),
  nightEndsAt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  nightStartsAt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
})
export const timekeepingHolidayInput = timekeepingInput.extend({
  holidayDate: z.string().date(),
  label: z.string().trim().min(1).max(120),
})
