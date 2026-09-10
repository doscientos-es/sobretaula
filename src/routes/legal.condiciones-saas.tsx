import { createFileRoute } from '@tanstack/react-router'

import { getPlatformLegalIdentity, LegalPage } from '@/features/legal'

export const Route = createFileRoute('/legal/condiciones-saas')({
  loader: () => getPlatformLegalIdentity(),
  component: SaaSTermsRoute,
})

function SaaSTermsRoute() {
  return <LegalPage document="saas-terms" identity={Route.useLoaderData()} />
}
