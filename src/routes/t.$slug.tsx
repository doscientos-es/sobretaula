import { DataViewState, DataViewStateDescription, DataViewStateTitle } from '@doscientos/ui'
import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router'

import { AppFrame } from '@/app/app-frame'
import { getTenantBillingStatus, TenantBillingNotice } from '@/features/platform-billing'
import { getTenantMembership, isTenantOperational, tenantBySlugQuery } from '@/features/tenancy'
import { getTenantVenues } from '@/features/venues'
import { parseTenantSlug } from '@/shared/lib/tenant/tenant-slug'

async function getMembershipOrRedirect(tenantId: string, tenantSlug: string) {
  try {
    return await getTenantMembership({ data: { tenantId } })
  } catch (error) {
    if (error instanceof Response && error.status === 403) throw error
    throw redirect({ to: '/login', search: { redirect: `/t/${tenantSlug}` } })
  }
}

export const Route = createFileRoute('/t/$slug')({
  loader: async ({ context, params }) => {
    const slug = parseTenantSlug(params.slug)
    if (!slug) throw notFound()

    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(slug))
    if (!tenant) throw notFound()

    const membership = await getMembershipOrRedirect(tenant.id, tenant.slug)

    const billingStatus = await getTenantBillingStatus({ data: { tenantId: tenant.id } })
    const venues = isTenantOperational(tenant.status)
      ? await getTenantVenues({ data: { tenantId: tenant.id } })
      : []
    return { billingStatus, membership, tenant, venues }
  },
  component: TenantLayout,
  notFoundComponent: TenantNotFound,
})

function TenantLayout() {
  const { billingStatus, tenant, venues } = Route.useLoaderData()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isSubscriptionInvoicesRoute = pathname === `/t/${tenant.slug}/suscripcion/facturas`
  const isTeamRoute = pathname === `/t/${tenant.slug}/equipo`

  if (!isTenantOperational(tenant.status)) {
    if (isSubscriptionInvoicesRoute || isTeamRoute) return <Outlet />

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
            <div className="mt-5 flex gap-4 text-sm">
              <Link className="text-primary underline" to="/onboarding">
                Revisar configuración de alta
              </Link>
              <Link
                className="text-primary underline"
                params={{ slug: tenant.slug }}
                to="/t/$slug/suscripcion/facturas"
              >
                Ver facturas de SobreTaula
              </Link>
              <Link
                className="text-primary underline"
                params={{ slug: tenant.slug }}
                to="/t/$slug/equipo"
              >
                Preparar equipo
              </Link>
            </div>
          )}
          {!setupPending && (
            <Link
              className="text-primary mt-5 inline-block text-sm underline"
              params={{ slug: tenant.slug }}
              to="/t/$slug/suscripcion/facturas"
            >
              Ver facturas de SobreTaula
            </Link>
          )}
        </DataViewState>
      </main>
    )
  }

  return (
    <AppFrame locale={tenant.defaultLocale} slug={tenant.slug} title={tenant.name} venues={venues}>
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
