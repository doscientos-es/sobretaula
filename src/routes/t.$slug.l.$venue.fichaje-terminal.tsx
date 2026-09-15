import { createFileRoute } from '@tanstack/react-router'

import { getTimekeepingTerminalStaff } from '@/features/timekeeping'

export const Route = createFileRoute('/t/$slug/l/$venue/fichaje-terminal')({
  loader: async ({ context }) => {
    const { tenant, venue } = context
    return {
      staff: await getTimekeepingTerminalStaff({
        data: { tenantId: tenant.id, venueId: venue.id },
      }),
      tenant,
      venue,
    }
  },
})
