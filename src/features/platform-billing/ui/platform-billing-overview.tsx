import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataViewState,
  DataViewStateDescription,
  DataViewStateTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
      <CardContent className="px-0">
        <section aria-label="Suscripciones de tenants">
          <Table className="min-w-[720px] text-left">
            <TableHeader className="text-muted-foreground">
              <TableRow>
                <TableHead>Restaurante</TableHead>
                <TableHead>Plan neto</TableHead>
                <TableHead>Locales</TableHead>
                <TableHead>Total neto</TableHead>
                <TableHead>Suscripción</TableHead>
                <TableHead>Próximo cobro</TableHead>
                <TableHead>Tenant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((subscription) => (
                <TableRow key={subscription.tenantSlug}>
                  <TableCell className="font-medium">{subscription.tenantName}</TableCell>
                  <TableCell>
                    {subscription.planName} · {euro.format(subscription.planMonthlyNetCents / 100)}
                    /mes + IVA
                  </TableCell>
                  <TableCell>{subscription.venueCount}</TableCell>
                  <TableCell>{euro.format(subscription.monthlyNetCents / 100)}/mes + IVA</TableCell>
                  <TableCell>
                    {statusLabel(subscription.status)}
                    {subscription.graceEndsOn ? ` · Gracia hasta ${subscription.graceEndsOn}` : ''}
                  </TableCell>
                  <TableCell>{subscription.nextPaymentOn ?? 'Sin programar'}</TableCell>
                  <TableCell className="capitalize">{subscription.tenantStatus}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </CardContent>
    </Card>
  )
}
