import { createFileRoute } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { getEmailBranding } from '@/features/communications/application/email-branding'
import { EmailBrandingPage } from '@/features/communications/ui/email-branding-page'
import { requireTenantRouteAccess } from '@/features/tenancy'

export const Route = createFileRoute('/t/$slug/comunicaciones')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: async ({ context }) => {
    const { tenant } = context
    return { branding: await getEmailBranding({ data: { tenantId: tenant.id } }), tenant }
  },
  component: CommunicationsRoute,
  ...tenantRouteState,
})

function CommunicationsRoute() {
  const { branding, tenant } = Route.useLoaderData()
  const role = Route.useRouteContext().tenantMembership.role
  return (
    <EmailBrandingPage
      branding={branding}
      canManage={role === 'owner' || role === 'manager'}
      defaultName={tenant.name}
      tenantId={tenant.id}
    />
  )
}
