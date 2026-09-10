import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformFiscalSettings, PlatformSettingsPage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/ajustes')({
  loader: () => loadPlatformRoute('/admin/ajustes', () => getPlatformFiscalSettings()),
  component: PlatformSettingsRoute,
  ...platformRouteState,
})

function PlatformSettingsRoute() {
  return <PlatformSettingsPage settings={Route.useLoaderData()} />
}
