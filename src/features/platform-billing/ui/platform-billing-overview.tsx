import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
} from '@doscientos/ui'

import type { PlatformSubscriptionOverview } from '../application/get-platform-billing-overview'

const euro = new Intl.NumberFormat('es-ES', { currency: 'EUR', style: 'currency' })

function statusLabel(status: PlatformSubscriptionOverview['status']): string {
  return {
    active: 'Activa',
    canceled: 'Cancelada',
    past_due: 'Impago',
    trialing: 'Primer año',
  }[status]
}

export function PlatformBillingOverview({
  subscriptions,
}: {
  subscriptions: PlatformSubscriptionOverview[]
}) {
  if (subscriptions.length === 0) {
    return (
      <DataViewState>
        <DataViewStateTitle>Aún no hay suscripciones</DataViewStateTitle>
        <DataViewStateDescription>
          Al crear un tenant y completar el pago aparecerá aquí su ciclo de facturación.
        </DataViewStateDescription>
      </DataViewState>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suscripciones activas</CardTitle>
        <CardDescription>Restaurantes, facturación recurrente y estado de acceso.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <section aria-label="Suscripciones de tenants">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="px-3 py-3 font-medium">Restaurante</th>
                <th className="px-3 py-3 font-medium">Plan neto</th>
                <th className="px-3 py-3 font-medium">Locales</th>
                <th className="px-3 py-3 font-medium">Total neto</th>
                <th className="px-3 py-3 font-medium">Suscripción</th>
                <th className="px-3 py-3 font-medium">Próximo cobro</th>
                <th className="px-3 py-3 font-medium">Tenant</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr className="border-b last:border-0" key={subscription.tenantSlug}>
                  <td className="px-3 py-3 font-medium">{subscription.tenantName}</td>
                  <td className="px-3 py-3">
                    {subscription.planName} · {euro.format(subscription.planMonthlyNetCents / 100)}
                    /mes + IVA
                  </td>
                  <td className="px-3 py-3">{subscription.venueCount}</td>
                  <td className="px-3 py-3">
                    {euro.format(subscription.monthlyNetCents / 100)}/mes + IVA
                  </td>
                  <td className="px-3 py-3">
                    {statusLabel(subscription.status)}
                    {subscription.graceEndsOn ? ` · Gracia hasta ${subscription.graceEndsOn}` : ''}
                  </td>
                  <td className="px-3 py-3">{subscription.nextPaymentOn ?? 'Sin programar'}</td>
                  <td className="px-3 py-3 capitalize">{subscription.tenantStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </CardContent>
    </Card>
  )
}
