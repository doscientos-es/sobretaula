import { DataViewState, DataViewStateDescription, DataViewStateTitle } from '@doscientos/ui'
import { createFileRoute, Link, notFound, Outlet, redirect } from '@tanstack/react-router'

import { AppFrame } from '@/app/app-frame'
import { getTenantBillingStatus, TenantBillingNotice } from '@/features/platform-billing'
import { getTenantMembership, isTenantOperational, tenantBySlugQuery } from '@/features/tenancy'
import { parseTenantSlug } from '@/shared/lib/tenant/tenant-slug'

export const Route = createFileRoute('/t/$slug')({
  loader: async ({ context, params }) => {
    const slug = parseTenantSlug(params.slug)
    if (!slug) throw notFound()

    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(slug))
    if (!tenant) throw notFound()

    try {
      await getTenantMembership({ data: { tenantId: tenant.id } })
    } catch (error) {
      if (error instanceof Response && error.status === 403) throw error
      throw redirect({ to: '/login', search: { redirect: `/t/${tenant.slug}` } })
    }

    const billingStatus = await getTenantBillingStatus({ data: { tenantId: tenant.id } })
    return { billingStatus, tenant }
  },
  component: TenantLayout,
  notFoundComponent: TenantNotFound,
})

function TenantLayout() {
  const { billingStatus, tenant } = Route.useLoaderData()

  if (!isTenantOperational(tenant.status)) {
    const setupPending = tenant.status === 'setup_pending'
    return (
      <main className="mx-auto max-w-2xl p-6">
        <DataViewState>
          <DataViewStateTitle>{tenant.name}</DataViewStateTitle>
          <DataViewStateDescription>
            {setupPending
              ? 'Tus datos de facturación se han guardado. Falta autorizar el método de pago seguro para activar el restaurante.'
              : 'Este restaurante está temporalmente en pausa por un cobro pendiente. Su información se conserva y se reactivará automáticamente al confirmarse el pago.'}
          </DataViewStateDescription>
          {setupPending && (
            <Link className="text-primary mt-5 inline-block text-sm underline" to="/onboarding">
              Revisar configuración de alta
            </Link>
          )}
        </DataViewState>
      </main>
    )
  }

  return (
    <AppFrame locale={tenant.defaultLocale} slug={tenant.slug} title={tenant.name}>
      <TenantBillingNotice status={billingStatus} />
      <Outlet />
    </AppFrame>
  )
}

function TenantNotFound() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <DataViewState>
        <DataViewStateTitle>Restaurante no encontrado</DataViewStateTitle>
        <DataViewStateDescription>
          No existe un restaurante con esta dirección.
        </DataViewStateDescription>
      </DataViewState>
    </main>
  )
}
