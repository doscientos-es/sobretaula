import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'

import type { PlatformDashboard } from '../application/platform-dashboard'

const euro = new Intl.NumberFormat('es-ES', { currency: 'EUR', style: 'currency' })

function tenantStatusLabel(status: PlatformDashboard['tenants'][number]['status']): string {
  return {
    active: 'Activo',
    setup_pending: 'Configuración pendiente',
    suspended: 'Suspendido',
    trial: 'Prueba',
  }[status]
}

function subscriptionStatusLabel(
  status: NonNullable<PlatformDashboard['tenants'][number]['subscription']>['status'],
) {
  return { active: 'Activa', canceled: 'Cancelada', past_due: 'Impago', trialing: 'Primer año' }[
    status
  ]
}

/** Platform-owner dashboard for tenant health, revenue, billing risk and access controls. */
export function PlatformConsolePage({ dashboard }: { dashboard: PlatformDashboard }) {
  const activeTenants = dashboard.tenants.filter((tenant) => tenant.status === 'active').length
  const suspendedTenants = dashboard.tenants.filter(
    (tenant) => tenant.status === 'suspended',
  ).length
  const recentTenants = dashboard.tenants.slice(0, 5)

  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Consola de superadministración</PageHeaderTitle>
          <PageHeaderDescription>
            Salud de tenants, ingresos recurrentes, riesgo de cobro y gobierno de accesos.
          </PageHeaderDescription>
        </div>
      </PageHeader>

      <section
        aria-label="Indicadores de plataforma"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Card>
          <CardHeader>
            <CardDescription>Tenants</CardDescription>
            <CardTitle>{dashboard.totalTenantCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {activeTenants} activos · {suspendedTenants} suspendidos
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ingreso mensual estimado</CardDescription>
            <CardTitle>{euro.format(dashboard.monthlyRecurringRevenueCents / 100)}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Suscripciones no canceladas
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Saldo pendiente</CardDescription>
            <CardTitle>{euro.format(dashboard.outstandingBalanceCents / 100)}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {dashboard.overdueSubscriptionCount} suscripciones en impago
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Control pendiente</CardDescription>
            <CardTitle>{dashboard.fiscalReviewCount + dashboard.pendingInvitationCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {dashboard.fiscalReviewCount} facturas fiscales · {dashboard.pendingInvitationCount}{' '}
            invitaciones
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Últimos tenants</CardTitle>
              <CardDescription>
                Los cinco restaurantes dados de alta más recientemente. Abre su ficha para revisarlo
                o configurarlo.
              </CardDescription>
            </div>
            <Link className="text-primary shrink-0 text-sm underline" to="/admin/tenants">
              Ver todos
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table className="min-w-[780px] text-left">
            <TableHeader className="text-muted-foreground">
              <TableRow>
                <TableHead className="px-5">Restaurante</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Suscripción</TableHead>
                <TableHead>Cobro</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTenants.map((tenant) => (
                <TableRow className="align-top" key={tenant.id}>
                  <TableCell className="px-5 py-4">
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Alta: {new Date(tenant.createdAt).toLocaleDateString('es-ES')}
                    </p>
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <span className="bg-muted rounded-full px-2 py-1 text-xs">
                      {tenantStatusLabel(tenant.status)}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    {tenant.subscription ? (
                      <>
                        <p>
                          {tenant.subscription.planName} ·{' '}
                          {subscriptionStatusLabel(tenant.subscription.status)}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {euro.format(tenant.subscription.monthlyNetCents / 100)}/mes netos
                        </p>
                      </>
                    ) : (
                      'Sin suscripción'
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    {tenant.subscription?.nextPaymentOn ?? 'Sin cobro programado'}
                    {tenant.subscription?.graceEndsOn && (
                      <p className="text-warning mt-1 text-xs">
                        Gracia: {tenant.subscription.graceEndsOn}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <Link
                      className="text-primary text-sm whitespace-nowrap underline"
                      params={{ tenantId: tenant.id }}
                      to="/admin/tenants/$tenantId"
                    >
                      Ver ficha
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {recentTenants.length === 0 && (
                <TableRow>
                  <TableCell className="text-muted-foreground px-5 py-8 text-center" colSpan={5}>
                    Aún no hay tenants dados de alta.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
