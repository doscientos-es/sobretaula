import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '@/features/legal'

export const Route = createFileRoute('/legal/cookies')({ component: CookiesRoute })

function CookiesRoute() {
  return <LegalPage document="cookies" identity={null} />
}
