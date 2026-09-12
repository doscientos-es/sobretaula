import {
  Badge,
  Button,
  type BadgeProps,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  Separator,
} from '@doscientos/ui'
import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  redirect,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import { ArrowLeft, Check, FileText, Store, TriangleAlert, Users } from 'lucide-react'
import type { ReactNode } from 'react'

import { TenantAdminFrame } from '@/app/app-frame'
import { WorkerFrame } from '@/app/worker-frame'
import { getTenantBillingStatus, TenantBillingNotice } from '@/features/platform-billing'
import { RedsysSubscriptionButton } from '@/features/platform-billing/ui/redsys-subscription-button'
import {
  getTenantBySlug,
  getDashboardMetrics,
  getTenantMembership,
  isTenantAdministrator,
  isTenantOperational,
  tenantBySlugQuery,
} from '@/features/tenancy'
import { getTenantVenues } from '@/features/venues'
import { LocaleProvider } from '@/shared/lib/i18n/locale-preference'
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
  errorComponent: TenantRouteError,
  notFoundComponent: TenantNotFound,
})

type StepStatus = 'done' | 'active' | 'upcoming'

function StepStatusBadge({ status }: { status: StepStatus }) {
  const label: Record<StepStatus, string> = {
    active: 'Ahora',
    done: 'Listo',
    upcoming: 'Pendiente',
  }
  const variant: Record<StepStatus, BadgeProps['variant']> = {
    active: 'default',
    done: 'success',
    upcoming: 'neutral',
  }
  return <Badge variant={variant[status]}>{label[status]}</Badge>
}

function OnboardingStep({
  status,
  title,
  description,
  index,
  isLast,
  children,
}: {
  status: StepStatus
  title: string
  description: string
  index: number
  isLast: boolean
  children?: ReactNode
}) {
  return (
    <div>
      <div className="flex items-start gap-4 py-4">
        <span
          className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            status === 'done'
              ? 'bg-success/15 text-success'
              : status === 'active'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {status === 'done' ? <Check className="size-4" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className={`text-sm font-medium ${status === 'upcoming' ? 'text-muted-foreground' : ''}`}
            >
              {title}
            </p>
            <StepStatusBadge status={status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm leading-6">{description}</p>
          {status === 'active' && children && <div className="mt-3">{children}</div>}
        </div>
      </div>
      {!isLast && <Separator />}
    </div>
  )
}

function TenantSetupPendingOnboarding({
  tenant,
  billingStatus,
}: {
  tenant: { id: string; name: string; slug: string }
  billingStatus: { hasPaymentMethod: boolean }
}) {
  const paymentDone = billingStatus.hasPaymentMethod
  const activationStatus: StepStatus = paymentDone ? 'active' : 'upcoming'
  const paymentStatus: StepStatus = paymentDone ? 'done' : 'active'

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{tenant.name}</PageHeaderTitle>
          <PageHeaderDescription>
            Ya casi está. Solo te queda un paso para empezar a trabajar.
          </PageHeaderDescription>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Pasos para activar tu restaurante</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <OnboardingStep
            description="Ya hemos guardado el nombre, la dirección y los datos fiscales de tu restaurante."
            index={1}
            isLast={false}
            status="done"
            title="Datos del restaurante"
          />
          <OnboardingStep
            description="Autoriza el pago seguro de la suscripción de SobreTaula (149 €/mes, sin IVA) para poder activar el restaurante."
            index={2}
            isLast={false}
            status={paymentStatus}
            title="Método de pago"
          >
            <RedsysSubscriptionButton tenantId={tenant.id} />
          </OnboardingStep>
          <OnboardingStep
            description={
              paymentDone
                ? 'Estamos confirmando tu alta. En cuanto se procese el pago, el restaurante se activará automáticamente.'
                : 'En cuanto autorices el pago, tu restaurante se activará automáticamente y podrás empezar a trabajar.'
            }
            index={3}
            isLast={true}
            status={activationStatus}
            title="Abrir operaciones"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mientras tanto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 pt-0 sm:grid-cols-3">
          <Link
            className={buttonVariants({ variant: 'outline' })}
            params={{ slug: tenant.slug }}
            to="/t/$slug/equipo"
          >
            <Users className="size-4" />
            Preparar equipo
          </Link>
          <Link
            className={buttonVariants({ variant: 'outline' })}
            params={{ slug: tenant.slug }}
            to="/t/$slug/suscripcion/facturas"
          >
            <FileText className="size-4" />
            Ver facturas
          </Link>
          <Link className={buttonVariants({ variant: 'outline' })} to="/onboarding">
            <Store className="size-4" />
            Revisar datos de alta
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}

function TenantPendingRouteFrame({
  children,
  isSetupStep,
  tenant,
}: {
  children: ReactNode
  isSetupStep: boolean
  tenant: { name: string; slug: string }
}) {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        params={{ slug: tenant.slug }}
        to="/t/$slug"
      >
        <ArrowLeft className="size-3.5" />
        {tenant.name}
      </Link>
      {isSetupStep && (
        <Badge variant="neutral">Parte de la configuración pendiente del restaurante</Badge>
      )}
      {children}
    </main>
  )
}

function TenantSuspendedNotice({
  canAuthorizePayment,
  tenant,
}: {
  canAuthorizePayment: boolean
  tenant: { id: string; name: string; slug: string }
}) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{tenant.name}</PageHeaderTitle>
          <PageHeaderDescription>
            El restaurante está temporalmente en pausa por un cobro pendiente. Tu información se
            conserva.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Card className="bg-destructive/8 ring-destructive/20 border-0 shadow-[0_8px_24px_rgb(35_39_45_/_7%)] ring-1 ring-inset">
        <CardContent className="flex gap-4 pt-6">
          <span className="bg-destructive/12 text-destructive grid size-10 shrink-0 place-items-center rounded-xl">
            <TriangleAlert aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h2 className="text-base font-semibold">Cobro pendiente</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                Regulariza el método de pago para reactivar el restaurante. Tu información se
                conserva.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canAuthorizePayment ? (
                <RedsysSubscriptionButton label="Regularizar pago seguro" tenantId={tenant.id} />
              ) : (
                <p className="text-muted-foreground text-xs">
                  Solo la persona propietaria puede autorizar este pago.
                </p>
              )}
              <Link
                className={buttonVariants({ variant: 'outline' })}
                params={{ slug: tenant.slug }}
                to="/t/$slug/suscripcion/facturas"
              >
                <FileText className="size-4" />
                Ver suscripción
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function TenantLayout() {
  const { billingStatus, membership, tenant, venues } = Route.useLoaderData()
  return (
    <LocaleProvider defaultLocale={tenant.defaultLocale}>
      <TenantLayoutContent />
    </LocaleProvider>
  )
}

function TenantLayoutContent() {
  const { billingStatus, membership, tenant, venues } = Route.useLoaderData()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isSubscriptionInvoicesRoute = pathname === `/t/${tenant.slug}/suscripcion/facturas`
  const isTeamRoute = pathname === `/t/${tenant.slug}/equipo`
  const isBillingRoute = pathname === `/t/${tenant.slug}/facturacion`

  if (!isTenantOperational(tenant.status)) {
    if (isBillingRoute || isSubscriptionInvoicesRoute || isTeamRoute) {
      return (
        <TenantPendingRouteFrame isSetupStep={tenant.status === 'setup_pending'} tenant={tenant}>
          <Outlet />
        </TenantPendingRouteFrame>
      )
    }

    return tenant.status === 'setup_pending' ? (
      <TenantSetupPendingOnboarding billingStatus={billingStatus} tenant={tenant} />
    ) : (
      <TenantSuspendedNotice canAuthorizePayment={membership.role === 'owner'} tenant={tenant} />
    )
  }

  const Frame = isTenantAdministrator(membership.role) ? TenantAdminFrame : WorkerFrame
  return (
    <Frame
      locale={tenant.defaultLocale}
      navigationLocked={billingStatus.status === 'trialing' && !billingStatus.hasPaymentMethod}
      role={membership.role}
      slug={tenant.slug}
      title={tenant.name}
      venues={venues}
    >
      <TenantBillingNotice
        canAuthorizePayment={membership.role === 'owner'}
        canManageBilling={isTenantAdministrator(membership.role)}
        status={billingStatus}
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
      />
      <Outlet />
    </Frame>
  )
}

function TenantRouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const { slug } = useParams({ from: '/t/$slug' })
  const status = error instanceof Response ? error.status : undefined
  const title =
    status === 403 ? 'No tienes permisos para acceder' : 'No se ha podido cargar esta pantalla'
  const description =
    status === 403
      ? 'Tu usuario no tiene acceso a este restaurante o a esta sección.'
      : status === 404
        ? 'El restaurante o la sección solicitada no existe.'
        : 'Ha ocurrido un problema al cargar los datos. Reintenta la operación; si continúa, contacta con soporte.'

  return (
    <main aria-live="assertive" className="mx-auto w-full max-w-2xl p-6 sm:p-10">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onPress={reset} type="button">
            Reintentar
          </Button>
          <Link
            className="text-primary text-sm font-medium underline underline-offset-4"
            params={{ slug }}
            to="/t/$slug/suscripcion/facturas"
          >
            Ver suscripción
          </Link>
        </CardContent>
      </Card>
    </main>
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
