import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
} from '@doscientos/ui'
import { createFileRoute, Link, notFound, Outlet, useParams } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { getTenantBySlug, requireTenantRouteAccess } from '@/features/tenancy'
import { getTenantVenues, resolveVenue } from '@/features/venues'
import { DEFAULT_LOCALE } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'
import { parseVenueSlug } from '@/shared/lib/tenant/venue-slug'

/**
 * Resolves the addressed local once so every child route works with an id the
 * server has already validated against the caller's access.
 */
export const Route = createFileRoute('/t/$slug/l/$venue')({
  beforeLoad: async ({ context, params }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'operations')
    const venueSlug = parseVenueSlug(params.venue)
    if (!venueSlug) throw notFound()

    const tenant = await getTenantBySlug({ data: { slug: params.slug } })
    if (!tenant) throw notFound()

    const venues = await getTenantVenues({ data: { tenantId: tenant.id } })
    const venue = resolveVenue(venues, venueSlug)
    if (!venue) throw notFound()

    return { tenant, venue }
  },
  component: VenueLayout,
  errorComponent: VenueRouteError,
  notFoundComponent: VenueNotFound,
  ...tenantRouteState,
})

function VenueLayout() {
  return <Outlet />
}

function VenueRouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const { slug } = useParams({ strict: false })
  const status = error instanceof Response ? error.status : undefined
  const title =
    status === 402
      ? 'Valida el método de pago para continuar'
      : status === 403
        ? 'No tienes permisos para acceder'
        : 'No se ha podido cargar esta pantalla'
  const description =
    status === 402
      ? 'Autoriza el pago seguro de la suscripción para desbloquear las operaciones del restaurante.'
      : status === 403
        ? 'Tu usuario no tiene acceso a este local o a esta sección.'
        : status === 404
          ? 'El local o la sección solicitada no existe.'
          : 'Ha ocurrido un problema al cargar los datos. Reintenta la operación; si continúa, contacta con soporte.'

  return (
    <div aria-live="assertive" className="mx-auto w-full max-w-2xl p-6 sm:p-10">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Button onPress={reset} type="button">
              Reintentar
            </Button>
            {status === 402 && slug ? (
              <Link
                className="text-primary text-sm font-medium underline underline-offset-4"
                params={{ slug }}
                to="/t/$slug/suscripcion/facturas"
              >
                Ir a suscripción
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function VenueNotFound() {
  const t = createTranslator(DEFAULT_LOCALE)

  return (
    <DataViewState>
      <DataViewStateTitle>{t('venue.notFound.title')}</DataViewStateTitle>
      <DataViewStateDescription>{t('venue.notFound.description')}</DataViewStateDescription>
    </DataViewState>
  )
}
