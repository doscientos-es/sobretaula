import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { ActivateAccountPage } from '@/features/auth'

const activationSearch = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/) })

export const Route = createFileRoute('/activar-cuenta')({
  validateSearch: activationSearch,
  component: ActivateAccountRoute,
})

function ActivateAccountRoute() {
  return <ActivateAccountPage invitationToken={Route.useSearch().token} />
}
