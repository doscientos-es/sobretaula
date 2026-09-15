import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { getTipsOverview } from '@/features/tips'

export const Route = createFileRoute('/t/$slug/l/$venue/propinas')({
  validateSearch: z.object({ page: z.number().int().min(1).default(1) }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, deps }) => {
    const { tenant, venue } = context
    return {
      overview: await getTipsOverview({
        data: { tenantId: tenant.id, venueId: venue.id, page: deps.page, pageSize: 25 },
      }),
      tenant,
      venue,
    }
  },
})
