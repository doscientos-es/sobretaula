import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { TenantRoutePending, tenantRouteState } from '@/app/tenant-route-loader'
import { getEmailBranding } from '@/features/communications/application/email-branding'
import { EmailBrandingPage } from '@/features/communications/ui/email-branding-page'
import { requireTenantRouteAccess } from '@/features/tenancy'

export const Route = createFileRoute('/t/$slug/comunicaciones')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: ({ context }) => ({ tenant: context.tenant }),
  component: CommunicationsRoute,
  ...tenantRouteState,
})

function CommunicationsRoute() {
  const { tenant } = Route.useLoaderData()
  const brandingQuery = useQuery(emailBrandingQuery(tenant.id))
  const role = Route.useRouteContext().tenantMembership.role
  if (brandingQuery.isPending) return <TenantRoutePending />
  if (brandingQuery.error) throw brandingQuery.error
  return (
    <EmailBrandingPage
      branding={brandingQuery.data}
      canManage={role === 'owner' || role === 'manager'}
      defaultName={tenant.name}
      tenantId={tenant.id}
    />
  )
}

function emailBrandingQuery(tenantId: string) {
  return queryOptions({
    queryFn: () => getEmailBranding({ data: { tenantId } }),
    queryKey: ['tenant', tenantId, 'email-branding'],
    staleTime: 60_000,
  })
}
