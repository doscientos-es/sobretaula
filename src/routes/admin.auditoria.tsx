import { createFileRoute, redirect } from '@tanstack/react-router'

import { getPlatformAuditLog, PlatformAuditPage } from '@/features/platform-admin'

export const Route = createFileRoute('/admin/auditoria')({
  loader: async () => {
    try {
      return await getPlatformAuditLog({ data: {} })
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/admin/auditoria' } })
      }
      throw error
    }
  },
  component: PlatformAuditRoute,
})

function PlatformAuditRoute() {
  return <PlatformAuditPage events={Route.useLoaderData()} />
}
