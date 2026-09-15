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
import { safeErrorDetails } from '@/app/root-error'
import { requireTenantRouteAccess } from '@/features/tenancy'
import { loadVenueRouteContext } from '@/features/venues'
import { DEFAULT_LOCALE } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

/** Validates the local addressed by the URL before rendering its nested routes. */
export const Route = createFileRoute('/t/$slug/l/$venue')({
  beforeLoad: async ({ context, location, params }) => {
    const isFloorPlan = location.pathname.endsWith('/plano')
    requireTenantRouteAccess(
      context.tenantMembership.role,
      isFloorPlan ? 'venue_management' : 'operations',
    )
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    return routeContext
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
          {status !== 402 && status !== 403 && status !== 404 ? (
            <details className="mb-4 text-sm">
              <summary className="cursor-pointer font-medium">Ver detalles técnicos</summary>
              <p className="mt-2 rounded-lg border bg-muted/40 p-3 font-mono text-xs break-words">
                {safeErrorDetails(error)}
              </p>
            </details>
          ) : null}
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
