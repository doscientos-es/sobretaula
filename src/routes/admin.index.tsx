import { createFileRoute } from '@tanstack/react-router'

import { loadPlatformRoute } from '@/app/platform-route-loader'
import {
  getPlatformDashboard,
  PlatformConsolePage,
  PlatformRouteError,
  PlatformRoutePending,
} from '@/features/platform-admin'

export const Route = createFileRoute('/admin/')({
  loader: () => loadPlatformRoute('/admin', () => getPlatformDashboard()),
  component: PlatformConsole,
  errorComponent: PlatformRouteError,
  pendingComponent: PlatformRoutePending,
  pendingMs: 200,
})

function PlatformConsole() {
  return <PlatformConsolePage dashboard={Route.useLoaderData()} />
}
