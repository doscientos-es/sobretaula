import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { TenantInvitationPage, getUserDestinations } from '@/features/tenancy'

const invitationSearch = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/) })

export const Route = createFileRoute('/invitacion')({
  validateSearch: invitationSearch,
  beforeLoad: async ({ location }) => {
    try {
      await getUserDestinations()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: location.href } })
      }
      throw error
    }
  },
  component: InvitationRoute,
})

function InvitationRoute() {
  return <TenantInvitationPage token={Route.useSearch().token} />
}