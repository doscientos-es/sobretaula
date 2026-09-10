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
import { useState } from 'react'

import {
  addCashMovement,
  closeCashRegister,
  openCashRegister,
  reconcileCashRegister,
  type getCashRegister,
  type listClosedCashRegisters,
} from '../application/cash-register'
import { cashDifferenceCents, expectedCashCents } from '../domain/cash-register'
import { CashMethodSummary } from './cash-method-summary'

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export function CashRegisterPage({
  register,
  history,
  tenantId,
  venueId,
  onDone,
}: {
  register: Awaited<ReturnType<typeof getCashRegister>>
  history: Awaited<ReturnType<typeof listClosedCashRegisters>>
  tenantId: string
  venueId: string
  onDone: () => void
}) {
  const feedback = useFormFeedback()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [outAmount, setOutAmount] = useState('')
  const [outReason, setOutReason] = useState('')
  const [float, setFloat] = useState('')
  const [counted, setCounted] = useState('')
  const [reconciliationNote, setReconciliationNote] = useState('')
  async function run(action: () => Promise<unknown>, success: string) {
    if (feedback.pending) return
    feedback.setPending()
    try {
      await action()
      feedback.setSuccess(success)
      onDone()
    } catch {
      feedback.setError('No se ha podido completar la operación.')
    }
  }
  const movements = register?.movements ?? []
  const cashSales = register?.cashSalesCents ?? 0
  const expected = register
    ? expectedCashCents(
        register.opening_float_cents as number,
        movements.map((m) => ({
          kind: m.kind as 'in' | 'out',
          amountCents: m.amount_cents as number,
        })),
        cashSales,
      )
    : 0
  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Caja</PageHeaderTitle>
          <PageHeaderDescription>
            Control de efectivo, movimientos y arqueo del turno.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      {!register ? (
        <Card>
          <CardHeader>
            <CardTitle>Abrir caja</CardTitle>
            <CardDescription>Introduce el fondo inicial del turno.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex max-w-sm items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void run(
                  () =>
                    openCashRegister({
                      data: {
                        tenantId,
                        venueId,
                        openingFloatCents: Math.round(Number(float) * 100),
                      },
                    }),
                  'Caja abierta.',
                )
              }}
            >
              <Field>
                <FieldLabel htmlFor="opening-float">Fondo (€)</FieldLabel>
                <Input
                  id="opening-float"
                  inputMode="decimal"
                  min="0"
                  onChange={(e) => setFloat(e.target.value)}
                  required
                  type="number"
                  value={float}
                />
              </Field>
              <Button type="submit">Abrir caja</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Caja abierta</CardTitle>
              <CardDescription>
                Fondo {money(register.opening_float_cents as number)} · Cobros en efectivo{' '}
                {money(cashSales)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-medium">Efectivo esperado: {money(expected)}</p>
              <CashMethodSummary salesByMethod={register.salesByMethod} />
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  void run(
                    () =>
                      addCashMovement({
                        data: {
                          tenantId,
                          venueId,
                          registerId: register.id as string,
                          kind: 'in',
                          amountCents: Math.round(Number(amount) * 100),
                          reason,
                        },
                      }),
                    'Entrada registrada.',
                  )
                }}
              >
                <Field>
                  <FieldLabel htmlFor="movement-amount">Entrada (€)</FieldLabel>
                  <Input
                    id="movement-amount"
                    min="0.01"
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    type="number"
                    value={amount}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="movement-reason">Motivo</FieldLabel>
                  <Input
                    id="movement-reason"
                    onChange={(e) => setReason(e.target.value)}
                    required
                    value={reason}
                  />
                </Field>
                <Button type="submit">Registrar entrada</Button>
              </form>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  void run(
                    () =>
                      addCashMovement({
                        data: {
                          tenantId,
                          venueId,
                          registerId: register.id as string,
                          kind: 'out',
                          amountCents: Math.round(Number(outAmount) * 100),
                          reason: outReason,
                        },
                      }),
                    'Salida registrada.',
                  )
                }}
              >
                <Field>
                  <FieldLabel htmlFor="cash-out-amount">Salida (€)</FieldLabel>
                  <Input
                    id="cash-out-amount"
                    min="0.01"
                    onChange={(e) => setOutAmount(e.target.value)}
                    required
                    type="number"
                    value={outAmount}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cash-out-reason">Motivo</FieldLabel>
                  <Input
                    id="cash-out-reason"
                    onChange={(e) => setOutReason(e.target.value)}
                    required
                    value={outReason}
                  />
                </Field>
                <Button type="submit">Registrar salida</Button>
              </form>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  void run(
                    () =>
                      closeCashRegister({
                        data: {
                          tenantId,
                          venueId,
                          registerId: register.id as string,
                          countedCashCents: Math.round(Number(counted) * 100),
                        },
                      }),
                    'Caja cerrada.',
                  )
                }}
              >
                <Field>
                  <FieldLabel htmlFor="counted-cash">Efectivo contado (€)</FieldLabel>
                  <Input
                    id="counted-cash"
                    min="0"
                    onChange={(e) => setCounted(e.target.value)}
                    required
                    type="number"
                    value={counted}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reconciliation-note">Nota del arqueo</FieldLabel>
                  <Input
                    id="reconciliation-note"
                    onChange={(e) => setReconciliationNote(e.target.value)}
                    value={reconciliationNote}
                  />
                </Field>
                <Button
                  onClick={() =>
                    void run(
                      () =>
                        reconcileCashRegister({
                          data: {
                            countedCashCents: Math.round(Number(counted) * 100),
                            note: reconciliationNote || undefined,
                            registerId: register.id as string,
                            tenantId,
                            venueId,
                          },
                        }),
                      'Arqueo guardado.',
                    )
                  }
                  disabled={feedback.pending || !counted}
                  type="button"
                  variant="outline"
                >
                  Guardar arqueo
                </Button>
                <Button type="submit" variant="destructive">
                  Cerrar y arquear
                </Button>
              </form>
              <FormFeedback pendingLabel="Guardando…" state={feedback.state} />
              {counted && (
                <p className="text-sm">
                  Diferencia prevista:{' '}
                  {money(cashDifferenceCents(expected, Math.round(Number(counted) * 100)))}
                </p>
              )}
              {(register.reconciliations as { id: string; variance_cents: number }[]).length >
                0 && (
                <div className="border-t pt-3 text-sm">
                  <p className="font-medium">Arqueos guardados en este turno</p>
                  <ul className="mt-2 space-y-1">
                    {(register.reconciliations as { id: string; variance_cents: number }[]).map(
                      (entry) => (
                        <li className="flex justify-between" key={entry.id}>
                          <span>Diferencia</span>
                          <span className="tabular-nums">{money(entry.variance_cents)}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de cierres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {history.map((entry) => (
              <div className="flex justify-between border-b pb-2" key={entry.id as string}>
                <span>{new Date(entry.closed_at as string).toLocaleString('es-ES')}</span>
                <span>Contado {money(entry.counted_cash_cents as number)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
