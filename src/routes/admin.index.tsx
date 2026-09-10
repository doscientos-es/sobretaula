import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute, platformRouteState } from '@/app/platform-route-loader'
import { getPlatformDashboard, PlatformConsolePage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/')({
  loader: () => loadPlatformRoute('/admin', () => getPlatformDashboard()),
  component: PlatformConsole,
  ...platformRouteState,
})

function PlatformConsole() {
  return <PlatformConsolePage dashboard={Route.useLoaderData()} />
}
