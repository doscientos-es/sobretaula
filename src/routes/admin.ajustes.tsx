import { createFileRoute } from '@tanstack/react-router'

import { getPlatformFiscalSettings, PlatformSettingsPage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/ajustes')({
  loader: () => getPlatformFiscalSettings(),
  component: PlatformSettingsRoute,
})

function PlatformSettingsRoute() {
  return <PlatformSettingsPage settings={Route.useLoaderData()} />
}
