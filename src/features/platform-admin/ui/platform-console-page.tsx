import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  useFormFeedback,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import type { FormEvent } from 'react'

import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import type { PlatformDashboard } from '../application/platform-dashboard'
import { updatePlatformTenantStatus } from '../application/platform-operators'

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
  const feedback = useFormFeedback()
  const reload = useLoaderReload()
  const activeTenants = dashboard.tenants.filter((tenant) => tenant.status === 'active').length
  const suspendedTenants = dashboard.tenants.filter(
    (tenant) => tenant.status === 'suspended',
  ).length

  async function controlTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const status = values.get('status')
    const tenantId = values.get('tenantId')
    const reason = values.get('reason')
    if ((status !== 'active' && status !== 'suspended') || typeof tenantId !== 'string') return
    feedback.setPending()
    try {
      await updatePlatformTenantStatus({
        data: { reason: typeof reason === 'string' ? reason : '', status, tenantId },
      })
      feedback.setSuccess('Estado del tenant actualizado y registrado en la auditoría.')
      event.currentTarget.reset()
      reload()
    } catch {
      feedback.setError('No se ha podido cambiar el estado. Revisa el motivo y tus permisos.')
    }
  }

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

      <FormFeedback pendingLabel="Actualizando tenant…" state={feedback.state} />
      <Card>
        <CardHeader>
          <CardTitle>Tenants y ciclo de cobro</CardTitle>
          <CardDescription>
            El cambio manual sólo permite suspender o reactivar y exige un motivo auditable.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="px-5 py-3 font-medium">Restaurante</th>
                <th className="px-3 py-3 font-medium">Tenant</th>
                <th className="px-3 py-3 font-medium">Suscripción</th>
                <th className="px-3 py-3 font-medium">Cobro</th>
                <th className="px-3 py-3 font-medium">Detalle</th>
                <th className="px-3 py-3 font-medium">Control manual</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.tenants.map((tenant) => (
                <tr className="border-b align-top last:border-0" key={tenant.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Alta: {new Date(tenant.createdAt).toLocaleDateString('es-ES')}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <span className="bg-muted rounded-full px-2 py-1 text-xs">
                      {tenantStatusLabel(tenant.status)}
                    </span>
                  </td>
                  <td className="px-3 py-4">
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
                  </td>
                  <td className="px-3 py-4">
                    {tenant.subscription?.nextPaymentOn ?? 'Sin cobro programado'}
                    {tenant.subscription?.graceEndsOn && (
                      <p className="text-warning mt-1 text-xs">
                        Gracia: {tenant.subscription.graceEndsOn}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <Link
                      className="text-primary text-sm underline"
                      params={{ tenantId: tenant.id }}
                      to="/admin/tenants/$tenantId"
                    >
                      Ver ficha
                    </Link>
                  </td>
                  <td className="px-3 py-4">
                    <form
                      className="flex min-w-[360px] gap-2"
                      onSubmit={(event) => void controlTenant(event)}
                    >
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <select
                        aria-label={`Nuevo estado para ${tenant.name}`}
                        className="border-input h-9 rounded-md border bg-transparent px-2"
                        defaultValue=""
                        name="status"
                      >
                        <option disabled value="">
                          Cambiar estado…
                        </option>
                        <option value="active">Reactivar</option>
                        <option value="suspended">Suspender</option>
                      </select>
                      <Field className="min-w-0 flex-1">
                        <FieldLabel className="sr-only" htmlFor={`reason-${tenant.id}`}>
                          Motivo
                        </FieldLabel>
                        <Input
                          id={`reason-${tenant.id}`}
                          minLength={5}
                          name="reason"
                          placeholder="Motivo obligatorio"
                          required
                        />
                      </Field>
                      <Button disabled={feedback.pending} size="sm" type="submit">
                        Aplicar
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  )
}
