import { Link } from '@tanstack/react-router'
import { CreditCard, TriangleAlert } from 'lucide-react'

import type { TenantBillingStatus } from '../application/get-tenant-billing-status'
import { RedsysSubscriptionButton } from './redsys-subscription-button'

export function TenantBillingNotice({
  canAuthorizePayment,
  canManageBilling,
  status,
  tenantId,
  tenantSlug,
}: {
  canAuthorizePayment: boolean
  canManageBilling: boolean
  status: TenantBillingStatus
  tenantId: string
  tenantSlug: string
}) {
  const needsPaymentAuthorization = status.status === 'trialing' && !status.hasPaymentMethod
  const paymentFailed = status.status === 'past_due'
  if (!needsPaymentAuthorization && !paymentFailed) return null

  const title = needsPaymentAuthorization
    ? 'Falta autorizar el método de pago'
    : 'El último cobro no se ha podido realizar'
  const description = needsPaymentAuthorization
    ? 'El restaurante no se activará hasta completar la autorización segura.'
    : `Regulariza el pago${status.graceEndsOn ? ` antes del ${status.graceEndsOn}` : ''} para evitar la pausa del restaurante.`

  return (
    <aside
      aria-labelledby="tenant-billing-notice-title"
      className={`border-border/70 mb-6 overflow-hidden rounded-2xl border text-sm shadow-[0_8px_24px_rgb(35_39_45_/_7%)] ${
        paymentFailed ? 'bg-destructive/8' : 'bg-primary/8'
      }`}
      role="alert"
    >
      <div className="flex gap-4 p-4 sm:p-5">
        <span
          aria-hidden="true"
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
            paymentFailed ? 'bg-destructive/12 text-destructive' : 'bg-primary/12 text-primary'
          }`}
        >
          {paymentFailed ? <TriangleAlert className="size-5" /> : <CreditCard className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-foreground text-base font-semibold" id="tenant-billing-notice-title">
            {title}
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl leading-6">{description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canAuthorizePayment ? (
              paymentFailed ? (
                <RedsysSubscriptionButton label="Reintentar pago seguro" tenantId={tenantId} />
              ) : (
                <RedsysSubscriptionButton tenantId={tenantId} />
              )
            ) : (
              <p className="text-muted-foreground text-xs">
                Solo la persona propietaria puede autorizar este pago.
              </p>
            )}
            {canManageBilling && (
              <Link
                className="text-foreground hover:bg-background/70 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors"
                params={{ slug: tenantSlug }}
                to="/t/$slug/suscripcion/facturas"
              >
                Ver suscripción
              </Link>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
