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
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
  useFormFeedback,
} from '@doscientos/ui'
import { useRef, useState, type FormEvent } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { formatMoney, parsePriceToCents } from '@/shared/lib/money/money'

import {
  applyDiscount,
  recordMixedPayment,
  recordGiftCardPayment,
  recordPayment,
  refundPayment,
  type AccountView,
} from '../application/account'
import {
  PAYMENT_METHODS,
  splitByAmounts,
  splitByPercentages,
  splitByProducts,
  splitEvenly,
  lineGrossCents,
  type AccountLine,
  type PaymentMethod,
} from '../domain/account'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  card: 'Tarjeta',
  cash: 'Efectivo',
  other: 'Otro',
  transfer: 'Transferencia',
  voucher: 'Vale',
  gift_card: 'Tarjeta regalo',
}

const SPLIT_OPTIONS = [2, 3, 4, 5, 6] as const

function paymentErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  if (error instanceof Response && error.status === 422)
    return 'El cobro supera el pendiente de la cuenta.'
  if (message.includes('payment_exceeds_balance'))
    return 'El cobro supera el pendiente de la cuenta.'
  if (message.includes('payment_session_not_open'))
    return 'La cuenta ya no está abierta. Actualiza la pantalla.'
  return fallback
}

/** Totals of the account plus the charge form with equal-part splitting. */
export function AccountPayments({
  account,
  canManageAdjustments,
  locale,
  onDone,
  tenantId,
  venueId,
}: {
  account: AccountView
  canManageAdjustments: boolean
  locale: Locale
  onDone: () => void
  tenantId: string
  venueId: string
}) {
  const { payments, session, totals } = account
  const feedback = useFormFeedback()
  const singlePaymentOperationId = useRef<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [giftCardCode, setGiftCardCode] = useState('')
  const [mixedMethodA, setMixedMethodA] = useState<PaymentMethod>('cash')
  const [mixedMethodB, setMixedMethodB] = useState<PaymentMethod>('card')
  const [amountDraft, setAmountDraft] = useState((totals.balanceCents / 100).toFixed(2))
  const [tipDraft, setTipDraft] = useState('')
  const [mixedAmountA, setMixedAmountA] = useState(
    (Math.floor(totals.balanceCents / 2) / 100).toFixed(2),
  )
  const [mixedAmountB, setMixedAmountB] = useState(
    (Math.ceil(totals.balanceCents / 2) / 100).toFixed(2),
  )
  const [mixedTipA, setMixedTipA] = useState('')
  const [mixedTipB, setMixedTipB] = useState('')
  const [parts, setParts] = useState<number>(2)
  const [splitMode, setSplitMode] = useState<'equal' | 'percentage' | 'amount' | 'product'>('equal')
  const [splitValues, setSplitValues] = useState('50,50')
  const [productAssignments, setProductAssignments] = useState<Record<string, number>>({})
  const [selectedShareIndex, setSelectedShareIndex] = useState<number | null>(null)
  const [discountDraft, setDiscountDraft] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null)
  const open = session.status === 'open'
  const settled = totals.balanceCents === 0
  let shares: number[] = []
  if (!settled) {
    try {
      shares =
        splitMode === 'equal'
          ? splitEvenly(totals.balanceCents, parts)
          : splitMode === 'percentage'
            ? splitByPercentages(
                totals.balanceCents,
                splitValues.split(',').map((value) => Number(value.trim())),
              )
            : splitMode === 'amount'
              ? splitByAmounts(
                  totals.balanceCents,
                  splitValues.split(',').map((value) => Number(value.trim())),
                )
              : splitByProducts(
                  account.lines,
                  Array.from({ length: parts }, (_, person) =>
                    account.lines
                      .filter((line) => productAssignments[line.id] === person)
                      .map((line) => line.id),
                  ),
                )
    } catch {
      shares = []
    }
  }

  function charge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountCents = parsePriceToCents(amountDraft)
    const tipCents = tipDraft.trim() === '' ? 0 : parsePriceToCents(tipDraft)
    if (amountCents === null || tipCents === null) {
      feedback.setError('Importe no válido. Usa euros con dos decimales, por ejemplo 25,50.')
      return
    }
    if (amountCents <= 0) {
      feedback.setError('El importe debe ser mayor que cero.')
      return
    }
    if (tipCents < 0) {
      feedback.setError('La propina no puede ser negativa.')
      return
    }
    if (amountCents > totals.balanceCents) {
      feedback.setError(
        `El importe supera el pendiente de ${formatMoney(totals.balanceCents, locale)}.`,
      )
      return
    }
    const allocations =
      splitMode === 'product'
        ? account.lines
            .filter((line) => productAssignments[line.id] === selectedShareIndex)
            .map((line) => ({
              amountCents: lineGrossCents(line),
              orderItemId: line.id,
              quantity: line.quantity,
            }))
        : undefined
    if (
      splitMode === 'product' &&
      account.lines.some((line) => productAssignments[line.id] === undefined)
    ) {
      feedback.setError('Asigna todas las líneas a una persona antes de cobrar.')
      return
    }
    if (splitMode === 'product' && selectedShareIndex === null) {
      feedback.setError('Selecciona la persona cuyo importe vas a cobrar.')
      return
    }
    if (feedback.pending) return
    feedback.setPending()
    if (method === 'gift_card') {
      void recordGiftCardPayment({
        data: {
          amountCents,
          code: giftCardCode,
          operationId: (singlePaymentOperationId.current ??= crypto.randomUUID()),
          sessionId: session.id,
          tenantId,
          venueId,
        },
      })
        .then(() => {
          singlePaymentOperationId.current = null
          onDone()
        })
        .catch((error: unknown) =>
          feedback.setError(
            paymentErrorMessage(error, 'No se ha podido aplicar la tarjeta regalo.'),
          ),
        )
      return
    }
    void recordPayment({
      data: {
        amountCents,
        method,
        operationId: (singlePaymentOperationId.current ??= crypto.randomUUID()),
        sessionId: session.id,
        tenantId,
        ...(allocations ? { allocations } : {}),
        ...(tipCents > 0 ? { tipCents } : {}),
        venueId,
      },
    })
      .then(() => {
        singlePaymentOperationId.current = null
        onDone()
      })
      .catch((error: unknown) =>
        feedback.setError(paymentErrorMessage(error, 'No se ha podido registrar el cobro.')),
      )
  }

  function refund(paymentId: string, amountCents: number) {
    if (feedback.pending) return
    feedback.setPending()
    void refundPayment({
      data: {
        amountCents,
        paymentId,
        reason: 'Devolución solicitada desde la cuenta',
        sessionId: session.id,
        tenantId,
        venueId,
      },
    })
      .then(() => {
        setRefundPaymentId(null)
        feedback.setSuccess('Devolución registrada.')
        onDone()
      })
      .catch(() => feedback.setError('No se ha podido registrar la devolución.'))
  }

  function mixedCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountA = parsePriceToCents(mixedAmountA)
    const amountB = parsePriceToCents(mixedAmountB)
    const tipA = mixedTipA.trim() === '' ? 0 : parsePriceToCents(mixedTipA)
    const tipB = mixedTipB.trim() === '' ? 0 : parsePriceToCents(mixedTipB)
    if (amountA === null || amountB === null || tipA === null || tipB === null) {
      feedback.setError('Importes mixtos no válidos.')
      return
    }
    if (amountA <= 0 || amountB <= 0) {
      feedback.setError('Cada parte del pago mixto debe ser mayor que cero.')
      return
    }
    if (mixedMethodA === mixedMethodB) {
      feedback.setError('Elige dos métodos de pago diferentes.')
      return
    }
    if (amountA + amountB > totals.balanceCents) {
      feedback.setError(
        `El importe supera el pendiente de ${formatMoney(totals.balanceCents, locale)}.`,
      )
      return
    }
    if (feedback.pending) return
    feedback.setPending()
    void recordMixedPayment({
      data: {
        lines: [
          { amountCents: amountA, method: mixedMethodA, tipCents: tipA },
          { amountCents: amountB, method: mixedMethodB, tipCents: tipB },
        ],
        operationId: crypto.randomUUID(),
        sessionId: session.id,
        tenantId,
        venueId,
      },
    })
      .then(() => {
        feedback.setSuccess('Pago mixto registrado.')
        onDone()
      })
      .catch((error: unknown) =>
        feedback.setError(paymentErrorMessage(error, 'No se ha podido registrar el pago mixto.')),
      )
  }

  function discount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cents = parsePriceToCents(discountDraft)
    if (cents === null || cents <= 0 || cents > totals.grossCents) {
      feedback.setError('Descuento no válido.')
      return
    }
    feedback.setPending()
    void applyDiscount({
      data: {
        discountCents: cents,
        reason: discountReason,
        sessionId: session.id,
        tenantId,
        venueId,
      },
    })
      .then(() => {
        feedback.setSuccess('Descuento aplicado.')
        onDone()
      })
      .catch(() => feedback.setError('No se ha podido aplicar el descuento.'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobrar</CardTitle>
        <CardDescription>
          Tarjeta se registra manualmente tras confirmarla en el datáfono; no se encola sin red.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="bg-surface-subtle space-y-2 rounded-xl p-4 text-sm">
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
          <div className="border-border/70 flex justify-between border-t pt-2 font-semibold">
            <dt>Pendiente</dt>
            <dd className="text-primary tabular-nums">
              {formatMoney(totals.balanceCents, locale)}
            </dd>
          </div>
        </dl>
        {open && canManageAdjustments && (
          <form className="grid gap-3 border-b pb-4 sm:grid-cols-2" onSubmit={discount}>
            <Field>
              <FieldLabel htmlFor="discount-amount">Descuento (€)</FieldLabel>
              <Input
                id="discount-amount"
                min="0.01"
                onChange={(event) => setDiscountDraft(event.target.value)}
                required
                value={discountDraft}
              />
            </Field>
            {method === 'gift_card' ? (
              <Field>
                <FieldLabel htmlFor="gift-card-code">Código de tarjeta regalo</FieldLabel>
                <Input
                  id="gift-card-code"
                  onChange={(event) => setGiftCardCode(event.target.value)}
                  required
                  value={giftCardCode}
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="discount-reason">Motivo</FieldLabel>
              <Input
                id="discount-reason"
                onChange={(event) => setDiscountReason(event.target.value)}
                required
                value={discountReason}
              />
            </Field>
            <Button className="sm:col-span-2" disabled={feedback.pending} size="sm" type="submit">
              Aplicar descuento
            </Button>
          </form>
        )}
        {!open && <p className="text-muted-foreground text-sm">La cuenta está cerrada.</p>}
        {open && settled && (
          <p className="text-success text-sm font-medium">Cuenta pagada por completo.</p>
        )}
        {open && !settled && (
          <form className="grid gap-4 border-t pt-4" onSubmit={charge}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="payment-method">Método</FieldLabel>
                <Select
                  className="w-full"
                  id="payment-method"
                  onSelectionChange={(key) => setMethod(String(key) as PaymentMethod)}
                  selectedKey={method}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      {PAYMENT_METHODS.map((option) => (
                        <SelectItem id={option} key={option}>
                          {PAYMENT_METHOD_LABEL[option]}
                        </SelectItem>
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="payment-parts">Dividir la cuenta</FieldLabel>
                <Select
                  className="w-full"
                  id="payment-parts"
                  onSelectionChange={(key) => setParts(Number(key))}
                  selectedKey={String(parts)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      {SPLIT_OPTIONS.map((option) => (
                        <SelectItem id={String(option)} key={option}>
                          {`${option} partes`}
                        </SelectItem>
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="payment-split-mode">Tipo de división</FieldLabel>
                <Select
                  className="w-full"
                  id="payment-split-mode"
                  onSelectionChange={(key) => {
                    const mode = String(key) as typeof splitMode
                    setSplitMode(mode)
                    if (mode === 'equal') setSplitValues('50,50')
                  }}
                  selectedKey={splitMode}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      <SelectItem id="equal">Partes iguales</SelectItem>
                      <SelectItem id="percentage">Por porcentaje</SelectItem>
                      <SelectItem id="amount">Por importe</SelectItem>
                      <SelectItem id="product">Por producto/persona</SelectItem>
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {splitMode === 'product' ? (
              <div className="grid gap-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Asigna cada línea a una persona</p>
                {account.lines.map((line: AccountLine) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    key={line.id}
                  >
                    <span>
                      {line.quantity}× {line.name}
                    </span>
                    <div className="flex gap-1">
                      {Array.from({ length: parts }, (_, person) => (
                        <Button
                          key={person}
                          onClick={() =>
                            setProductAssignments((current) => ({ ...current, [line.id]: person }))
                          }
                          size="sm"
                          type="button"
                          variant={productAssignments[line.id] === person ? 'default' : 'outline'}
                        >
                          P{person + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : splitMode !== 'equal' ? (
              <Field>
                <FieldLabel htmlFor="payment-split-values">
                  {splitMode === 'percentage'
                    ? 'Porcentajes separados por comas (ej. 50,30,20)'
                    : 'Importes en céntimos separados por comas'}
                </FieldLabel>
                <Input
                  id="payment-split-values"
                  inputMode="decimal"
                  onChange={(event) => setSplitValues(event.target.value)}
                  value={splitValues}
                />
              </Field>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2" aria-label="Importes sugeridos">
              {shares.map((share, index) => (
                <Button
                  key={`${parts}-${index}`}
                  onClick={() => {
                    setSelectedShareIndex(index)
                    setAmountDraft((share / 100).toFixed(2))
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {`Parte ${index + 1}: ${formatMoney(share, locale)}`}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <FormFeedback pendingLabel="Registrando cobro…" state={feedback.state} />
            <Button disabled={feedback.pending} type="submit">
              Registrar cobro
            </Button>
          </form>
        )}
        {open && !settled && (
          <form className="grid gap-4 border-t pt-4" onSubmit={mixedCharge}>
            <div>
              <h3 className="font-medium">Pago mixto</h3>
              <p className="text-muted-foreground text-sm">
                Registra varios métodos en una sola operación atómica.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mixed-method-a">Primer método</FieldLabel>
                <Select
                  className="w-full"
                  id="mixed-method-a"
                  onSelectionChange={(key) => setMixedMethodA(String(key) as PaymentMethod)}
                  selectedKey={mixedMethodA}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      {PAYMENT_METHODS.filter((option) => option !== 'gift_card').map((option) => (
                        <SelectItem id={option} key={option}>
                          {PAYMENT_METHOD_LABEL[option]}
                        </SelectItem>
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="mixed-amount-a">Importe (€)</FieldLabel>
                <Input
                  id="mixed-amount-a"
                  inputMode="decimal"
                  onChange={(event) => setMixedAmountA(event.target.value)}
                  required
                  value={mixedAmountA}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="mixed-method-b">Segundo método</FieldLabel>
                <Select
                  className="w-full"
                  id="mixed-method-b"
                  onSelectionChange={(key) => setMixedMethodB(String(key) as PaymentMethod)}
                  selectedKey={mixedMethodB}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      {PAYMENT_METHODS.filter((option) => option !== 'gift_card').map((option) => (
                        <SelectItem id={option} key={option}>
                          {PAYMENT_METHOD_LABEL[option]}
                        </SelectItem>
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="mixed-amount-b">Importe (€)</FieldLabel>
                <Input
                  id="mixed-amount-b"
                  inputMode="decimal"
                  onChange={(event) => setMixedAmountB(event.target.value)}
                  required
                  value={mixedAmountB}
                />
              </Field>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer">Propinas opcionales</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="mixed-tip-a">Propina primer método (€)</FieldLabel>
                  <Input
                    id="mixed-tip-a"
                    inputMode="decimal"
                    onChange={(event) => setMixedTipA(event.target.value)}
                    placeholder="0,00"
                    value={mixedTipA}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="mixed-tip-b">Propina segundo método (€)</FieldLabel>
                  <Input
                    id="mixed-tip-b"
                    inputMode="decimal"
                    onChange={(event) => setMixedTipB(event.target.value)}
                    placeholder="0,00"
                    value={mixedTipB}
                  />
                </Field>
              </div>
            </details>
            <Button disabled={feedback.pending} type="submit">
              Registrar pago mixto
            </Button>
          </form>
        )}
        {payments.length > 0 && (
          <ul className="space-y-1 border-t pt-4 text-sm">
            {payments.map((payment) => (
              <li className="flex justify-between" key={payment.id}>
                <span className="text-muted-foreground">
                  {PAYMENT_METHOD_LABEL[payment.method]}
                  <span className="ml-2 text-xs">
                    {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
                      new Date(payment.paidAt),
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {formatMoney(payment.amountCents, locale)}
                  {(payment.refundedCents ?? 0) > 0 &&
                    ` · devuelto ${formatMoney(payment.refundedCents ?? 0, locale)}`}
                  {payment.tipCents > 0 && ` + ${formatMoney(payment.tipCents, locale)} propina`}
                  {canManageAdjustments && refundPaymentId === payment.id ? (
                    <span className="flex items-center gap-1">
                      <Button
                        disabled={feedback.pending}
                        onClick={() => refund(payment.id, payment.amountCents)}
                        size="sm"
                        type="button"
                      >
                        Confirmar devolución
                      </Button>
                      <Button
                        disabled={feedback.pending}
                        onClick={() => setRefundPaymentId(null)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Cancelar
                      </Button>
                    </span>
                  ) : canManageAdjustments ? (
                    <Button
                      disabled={feedback.pending}
                      onClick={() => setRefundPaymentId(payment.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Devolver
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
