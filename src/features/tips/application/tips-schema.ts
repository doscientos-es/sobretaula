import { z } from 'zod'
export const tipsInput = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
})
export const saveTipInput = tipsInput.extend({
  date: z.string().date(),
  amountCents: z.number().int().min(0),
  note: z.string().max(500).optional(),
})
export const updateTipInput = tipsInput.extend({
  entryId: z.string().uuid(),
  amountCents: z.number().int().min(0),
  note: z.string().max(500).optional(),
})
export const deleteTipInput = tipsInput.extend({ entryId: z.string().uuid() })
export const closeTipsInput = tipsInput.extend({ from: z.string().date(), to: z.string().date() })
