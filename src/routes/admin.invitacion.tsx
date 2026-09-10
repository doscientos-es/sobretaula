import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { loadPlatformRoute } from '@/app/platform-route-loader'
import { PlatformInvitationPage } from '@/features/platform-admin'
import { getUserDestinations } from '@/features/tenancy'

const invitationSearch = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/) })

export const Route = createFileRoute('/admin/invitacion')({
  validateSearch: invitationSearch,
  beforeLoad: ({ location }) => loadPlatformRoute(location.href, () => getUserDestinations()),
  component: PlatformInvitationRoute,
})

function PlatformInvitationRoute() {
  return <PlatformInvitationPage token={Route.useSearch().token} />
}
