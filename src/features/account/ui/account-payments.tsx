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
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { formatMoney, parsePriceToCents } from '@/shared/lib/money/money'

import { recordPayment, type AccountView } from '../application/account'
import { PAYMENT_METHODS, splitEvenly, type PaymentMethod } from '../domain/account'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  card: 'Tarjeta',
  cash: 'Efectivo',
  other: 'Otro',
  transfer: 'Transferencia',
  voucher: 'Vale',
}

const SPLIT_OPTIONS = [2, 3, 4, 5, 6] as const

/** Totals of the account plus the charge form with equal-part splitting. */
export function AccountPayments({
  account,
  locale,
  onDone,
  tenantId,
  venueId,
}: {
  account: AccountView
  locale: Locale
  onDone: () => void
  tenantId: string
  venueId: string
}) {
  const { payments, session, totals } = account
  const feedback = useFormFeedback()
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amountDraft, setAmountDraft] = useState((totals.balanceCents / 100).toFixed(2))
  const [tipDraft, setTipDraft] = useState('')
  const [parts, setParts] = useState<number>(2)
  const open = session.status === 'open'
  const settled = totals.balanceCents === 0
  const shares = settled ? [] : splitEvenly(totals.balanceCents, parts)

  function charge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountCents = parsePriceToCents(amountDraft)
    const tipCents = tipDraft.trim() === '' ? 0 : parsePriceToCents(tipDraft)
    if (amountCents === null || tipCents === null) {
      feedback.setError('Importe no válido. Usa euros con dos decimales, por ejemplo 25,50.')
      return
    }
    if (feedback.pending) return
    feedback.setPending()
    void recordPayment({
      data: {
        amountCents,
        method,
        sessionId: session.id,
        tenantId,
        ...(tipCents > 0 ? { tipCents } : {}),
        venueId,
      },
    })
      .then(() => onDone())
      .catch(() => feedback.setError('No se ha podido registrar el cobro.'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobrar</CardTitle>
        <CardDescription>Los importes salen de la carta con IVA incluido.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Neto</dt>
            <dd className="tabular-nums">{formatMoney(totals.netCents, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">IVA</dt>
            <dd className="tabular-nums">{formatMoney(totals.vatCents, locale)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(totals.grossCents, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Pagado</dt>
            <dd className="tabular-nums">{formatMoney(totals.paidCents, locale)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Pendiente</dt>
            <dd className="tabular-nums">{formatMoney(totals.balanceCents, locale)}</dd>
          </div>
        </dl>
        {!open && <p className="text-muted-foreground text-sm">La cuenta está cerrada.</p>}
        {open && settled && (
          <p className="text-success text-sm font-medium">Cuenta pagada por completo.</p>
        )}
        {open && !settled && (
          <form className="grid gap-4 border-t pt-4" onSubmit={charge}>
            <Field>
              <FieldLabel htmlFor="payment-method">Método</FieldLabel>
              <select
                id="payment-method"
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                value={method}
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option} value={option}>
                    {PAYMENT_METHOD_LABEL[option]}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-parts">Dividir la cuenta</FieldLabel>
              <select
                id="payment-parts"
                onChange={(event) => setParts(Number(event.target.value))}
                value={parts}
              >
                {SPLIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {`${option} partes`}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              {shares.map((share, index) => (
                <Button
                  key={`${parts}-${index}`}
                  onClick={() => setAmountDraft((share / 100).toFixed(2))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {`Parte ${index + 1}: ${formatMoney(share, locale)}`}
                </Button>
              ))}
            </div>
            <Field>
              <FieldLabel htmlFor="payment-amount">Importe a cobrar (euros)</FieldLabel>
              <Input
                id="payment-amount"
                inputMode="decimal"
                onChange={(event) => setAmountDraft(event.target.value)}
                required
                value={amountDraft}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-tip">Propina (opcional)</FieldLabel>
              <Input
                id="payment-tip"
                inputMode="decimal"
                onChange={(event) => setTipDraft(event.target.value)}
                placeholder="0,00"
                value={tipDraft}
              />
            </Field>
            <FormFeedback pendingLabel="Registrando cobro…" state={feedback.state} />
            <Button disabled={feedback.pending} type="submit">
              Registrar cobro
            </Button>
          </form>
        )}
        {payments.length > 0 && (
          <ul className="space-y-1 border-t pt-4 text-sm">
            {payments.map((payment) => (
              <li className="flex justify-between" key={payment.id}>
                <span className="text-muted-foreground">
                  {PAYMENT_METHOD_LABEL[payment.method]}
                </span>
                <span className="tabular-nums">
                  {formatMoney(payment.amountCents, locale)}
                  {payment.tipCents > 0 && ` + ${formatMoney(payment.tipCents, locale)} propina`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
