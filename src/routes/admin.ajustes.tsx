import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute } from '@/app/platform-route-loader'
import {
  getPlatformFiscalSettings,
  PlatformRouteError,
  PlatformRoutePending,
  PlatformSettingsPage,
} from '@/features/platform-admin'

export const Route = createFileRoute('/admin/ajustes')({
  loader: () => loadPlatformRoute('/admin/ajustes', () => getPlatformFiscalSettings()),
  component: PlatformSettingsRoute,
  errorComponent: PlatformRouteError,
  pendingComponent: PlatformRoutePending,
  pendingMs: 200,
})

function PlatformSettingsRoute() {
  return <PlatformSettingsPage settings={Route.useLoaderData()} />
}
