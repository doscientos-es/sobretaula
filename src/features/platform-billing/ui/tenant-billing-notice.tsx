import type { TenantBillingStatus } from '../application/get-tenant-billing-status'

export function TenantBillingNotice({ status }: { status: TenantBillingStatus }) {
  if (status.status === 'trialing' && !status.hasPaymentMethod) {
    return (
      <aside className="border-primary/30 bg-primary/5 text-foreground mb-5 rounded-xl border p-4 text-sm">
        <strong>Falta autorizar el método de pago de SobreTaula.</strong>
        <p className="mt-1">
          El restaurante no se activará hasta completar la autorización segura.
        </p>
      </aside>
    )
  }
  if (status.status !== 'past_due') return null

  return (
    <aside className="border-destructive/30 bg-destructive/5 text-foreground mb-5 rounded-xl border p-4 text-sm">
      <strong>El último cobro de SobreTaula no se ha podido realizar.</strong>
      <p className="mt-1">
        Regulariza o actualiza el método de pago antes del{' '}
        {status.graceEndsOn ?? 'fin de la gracia'}
        para evitar la pausa del restaurante.
      </p>
    </aside>
  )
}
