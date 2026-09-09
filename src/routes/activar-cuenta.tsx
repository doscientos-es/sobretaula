import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { ActivateAccountPage } from '@/features/auth'

const activationSearch = z.object({
  scope: z.enum(['platform', 'tenant']).default('tenant'),
  token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/),
})

export const Route = createFileRoute('/activar-cuenta')({
  validateSearch: activationSearch,
  component: ActivateAccountRoute,
})

function ActivateAccountRoute() {
  const { scope, token } = Route.useSearch()
  return (
    <ActivateAccountPage
      invitationPath={scope === 'platform' ? '/admin/invitacion' : '/invitacion'}
      invitationToken={token}
    />
  )
}
