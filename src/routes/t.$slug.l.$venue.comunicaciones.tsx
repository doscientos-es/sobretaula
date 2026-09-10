import { createFileRoute } from '@tanstack/react-router'
import { NotificationJobsPage } from '@/features/notifications'

export const Route = createFileRoute('/t/$slug/l/$venue/comunicaciones')({ component: CommunicationsRoute })
function CommunicationsRoute() { const { tenant } = Route.useRouteContext(); return <NotificationJobsPage tenantId={tenant.id} /> }
