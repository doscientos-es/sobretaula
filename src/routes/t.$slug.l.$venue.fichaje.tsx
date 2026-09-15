import { createFileRoute } from '@tanstack/react-router'

import { getMyTimekeeping, getTimekeepingConfiguration } from '@/features/timekeeping'
export const Route = createFileRoute('/t/$slug/l/$venue/fichaje')({
  loader: async ({ context }) => {
    const { tenant, venue } = context
    const data = { tenantId: tenant.id, venueId: venue.id }
    const [summary, management] = await Promise.all([
      getMyTimekeeping({ data }),
      ['owner', 'manager'].includes(context.tenantMembership.role)
        ? getTimekeepingConfiguration({ data })
        : Promise.resolve(null),
    ])
    return { management, summary, tenant, venue }
  },
})
