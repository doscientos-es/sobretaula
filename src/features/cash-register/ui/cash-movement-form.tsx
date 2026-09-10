import { Button, Field, FieldLabel, Input, useFormFeedback } from '@doscientos/ui'
import { useState } from 'react'

import { addCashMovement } from '../application/cash-register'
export function CashMovementForm({
  registerId,
  tenantId,
  venueId,
  onDone,
}: {
  registerId: string
  tenantId: string
  venueId: string
  onDone: () => void
}) {
  const feedback = useFormFeedback()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        feedback.setPending()
        void addCashMovement({
          data: {
            registerId,
            tenantId,
            venueId,
            kind: 'out',
            amountCents: Math.round(Number(amount) * 100),
            reason,
          },
        })
          .then(() => {
            setAmount('')
            setReason('')
            feedback.setSuccess('Salida registrada.')
            onDone()
          })
          .catch(() => feedback.setError('No se ha podido registrar la salida.'))
      }}
    >
      <Field>
        <FieldLabel htmlFor="cash-out-amount">Salida (€)</FieldLabel>
        <Input
          id="cash-out-amount"
          min="0.01"
          onChange={(event) => setAmount(event.target.value)}
          required
          type="number"
          value={amount}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="cash-out-reason">Motivo</FieldLabel>
        <Input
          id="cash-out-reason"
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        />
      </Field>
      <Button type="submit">Registrar salida</Button>
    </form>
  )
}
