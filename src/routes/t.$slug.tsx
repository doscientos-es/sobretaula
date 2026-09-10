import {
  Badge,
  type BadgeProps,
  buttonVariants,
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
  Separator,
} from '@doscientos/ui'
import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { TenantAdminFrame } from '@/app/app-frame'
import { WorkerFrame } from '@/app/worker-frame'
import { getTenantBillingStatus, TenantBillingNotice } from '@/features/platform-billing'
import {
  getTenantBySlug,
  getDashboardMetrics,
  getTenantMembership,
  isTenantAdministrator,
  isTenantOperational,
  tenantBySlugQuery,
} from '@/features/tenancy'
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
  beforeLoad: async ({ params }) => {
    const slug = parseTenantSlug(params.slug)
    if (!slug) throw notFound()

    const tenant = await getTenantBySlug({ data: { slug } })
    if (!tenant) throw notFound()

    return {
      tenantMembership: await getMembershipOrRedirect(tenant.id, tenant.slug),
    }
  },
  loader: async ({ context, params }) => {
    const slug = parseTenantSlug(params.slug)
    if (!slug) throw notFound()

    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(slug))
    if (!tenant) throw notFound()

    const billingStatus = await getTenantBillingStatus({
      data: { tenantId: tenant.id },
    })
    const venues = isTenantOperational(tenant.status)
      ? await getTenantVenues({ data: { tenantId: tenant.id } })
      : []
    const metrics = isTenantOperational(tenant.status)
      ? await getDashboardMetrics({
          data: {
            tenantId: tenant.id,
            venueIds: venues.map((venue) => venue.id),
          },
        })
      : {
          actionItems: [],
          nextReservationCovers: null,
          nextReservationStartsAt: null,
          openSessionCount: 0,
          occupiedTables: 0,
          paidTodayCents: 0,
          pendingReservationsToday: 0,
          reservationsToday: 0,
          reservationsThisWeek: 0,
          noShowsThisWeek: 0,
        }
    return {
      billingStatus,
      membership: context.tenantMembership,
      metrics,
      tenant,
      venues,
    }
  },
  component: TenantLayout,
  notFoundComponent: TenantNotFound,
})

function TenantLayout() {
  const { billingStatus, membership, tenant, venues } = Route.useLoaderData()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isSubscriptionInvoicesRoute = pathname === `/t/${tenant.slug}/suscripcion/facturas`
  const isTeamRoute = pathname === `/t/${tenant.slug}/equipo`
  const isBillingRoute = pathname === `/t/${tenant.slug}/facturacion`

  if (!isTenantOperational(tenant.status)) {
    if (isBillingRoute || isSubscriptionInvoicesRoute || isTeamRoute) return <Outlet />

    const setupPending = tenant.status === 'setup_pending'
    return (
      <main className="bg-muted/30 min-h-screen p-4 sm:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="border-primary/20 from-primary/10 rounded-2xl border bg-gradient-to-br to-transparent p-6 sm:p-8">
            <p className="text-primary text-sm font-semibold tracking-wide uppercase">Sobretaula</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{tenant.name}</h1>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
              {setupPending
                ? 'Tu restaurante está casi listo. Completa estos últimos pasos para empezar a trabajar.'
                : 'El restaurante está temporalmente en pausa por un cobro pendiente. Tu información se conserva.'}
            </p>
          </div>
          {setupPending && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['✓', 'Datos del restaurante', 'Completados'],
                ['2', 'Método de pago', 'Requiere autorización'],
                ['3', 'Abrir operaciones', 'Se activa al confirmar'],
              ].map(([step, title, detail]) => (
                <div className="bg-background rounded-xl border p-4" key={title}>
                  <span className="bg-primary/10 text-primary inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                    {step}
                  </span>
                  <p className="mt-3 text-sm font-medium">{title}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
                </div>
              ))}
            </div>
          )}
          <div className="bg-background rounded-2xl border p-6 shadow-sm">
            <p className="text-sm leading-6">
              {setupPending
                ? 'Tus datos de facturación se han guardado. Falta autorizar el método de pago seguro para activar el restaurante.'
                : 'Este restaurante está temporalmente en pausa por un cobro pendiente.'}
            </p>
            {setupPending && (
              <div className="mt-5 flex flex-wrap gap-4 text-sm">
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
          </div>
        </div>
      </main>
    )
  }

  const Frame = isTenantAdministrator(membership.role) ? TenantAdminFrame : WorkerFrame
  return (
    <Frame locale={tenant.defaultLocale} slug={tenant.slug} title={tenant.name} venues={venues}>
      <TenantBillingNotice status={billingStatus} />
      <Outlet />
    </Frame>
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
