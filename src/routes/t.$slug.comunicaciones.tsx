import { createFileRoute, notFound } from '@tanstack/react-router'

import { EmailBrandingPage, getEmailBranding } from '@/features/communications'
import { requireTenantRouteAccess, tenantBySlugQuery } from '@/features/tenancy'

export const Route = createFileRoute('/t/$slug/comunicaciones')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: async ({ context, params }) => {
    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(params.slug))
    if (!tenant) throw notFound()
    return { branding: await getEmailBranding({ data: { tenantId: tenant.id } }), tenant }
  },
  component: CommunicationsRoute,
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
