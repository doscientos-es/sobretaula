import { z } from 'zod'
export const salesReportInput = z
  .object({
    tenantId: z.string().uuid(),
    venueId: z.string().uuid(),
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine((value) => value.from < value.to, {
    message: 'report_range_invalid',
    path: ['to'],
  })
