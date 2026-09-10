import { createFileRoute } from '@tanstack/react-router'

import { getPlatformLegalIdentity, LegalPage } from '@/features/legal'

export const Route = createFileRoute('/legal/privacidad')({
  loader: () => getPlatformLegalIdentity(),
  component: PlatformPrivacyRoute,
})

function PlatformPrivacyRoute() {
  return <LegalPage document="platform-privacy" identity={Route.useLoaderData()} />
}
