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

import { seatReservation } from '../application/table-service'
import { addToWaitlist, removeFromWaitlist, seatWaitlistEntry } from '../application/waitlist'
import type { ServiceBoard } from '../domain/service-board'
import { describeTime } from './service-labels'

/** The door: bookings about to arrive and parties waiting without one. */
export function ServiceQueue({
  board,
  onDone,
  selectedTableIds,
  tenantId,
  venueId,
}: {
  board: ServiceBoard
  onDone: () => void
  selectedTableIds: readonly string[]
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()
  const [guestName, setGuestName] = useState('')
  const [partySize, setPartySize] = useState(2)

  async function run(action: () => Promise<unknown>, message: string) {
    if (feedback.pending) return
    feedback.setPending()
    try {
      await action()
      onDone()
    } catch {
      feedback.setError(message)
    }
  }

  function addWaiting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(
      () =>
        addToWaitlist({
          data: {
            estimatedWaitMinutes: null,
            ...(guestName ? { guestName } : {}),
            partySize,
            tenantId,
            venueId,
          },
        }),
      'No se ha podido anotar la espera.',
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Puerta</CardTitle>
        <CardDescription>Próximas reservas y lista de espera.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Reservas próximas</h3>
          {board.reservations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay reservas en las próximas horas.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {board.reservations.map((reservation) => (
                <li key={reservation.id} className="flex items-center justify-between gap-2">
                  <span>
                    {`${describeTime(reservation.startsAt)} · ${reservation.guestName ?? 'Sin nombre'} · ${reservation.partySize} pax`}
                  </span>
                  <Button
                    disabled={feedback.pending}
                    onClick={() =>
                      void run(
                        () =>
                          seatReservation({
                            data: { reservationId: reservation.id, tenantId, venueId },
                          }),
                        'No se ha podido sentar la reserva.',
                      )
                    }
                    type="button"
                  >
                    Sentar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2 border-t pt-6">
          <h3 className="text-sm font-medium">Lista de espera</h3>
          {board.waitlist.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nadie esperando.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {board.waitlist.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2">
                  <span>{`${entry.guestName ?? 'Sin nombre'} · ${entry.partySize} pax`}</span>
                  <span className="flex gap-2">
                    <Button
                      disabled={feedback.pending || selectedTableIds.length === 0}
                      onClick={() =>
                        void run(
                          () =>
                            seatWaitlistEntry({
                              data: {
                                tableIds: [...selectedTableIds],
                                tenantId,
                                venueId,
                                waitlistEntryId: entry.id,
                              },
                            }),
                          'Esas mesas no sirven para este grupo.',
                        )
                      }
                      type="button"
                    >
                      Sentar
                    </Button>
                    <Button
                      disabled={feedback.pending}
                      onClick={() =>
                        void run(
                          () =>
                            removeFromWaitlist({
                              data: { tenantId, venueId, waitlistEntryId: entry.id },
                            }),
                          'No se ha podido quitar de la lista.',
                        )
                      }
                      type="button"
                    >
                      Quitar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form className="grid gap-3 border-t pt-6" onSubmit={addWaiting}>
          <Field>
            <FieldLabel htmlFor="waitlist-name">Nombre (opcional)</FieldLabel>
            <Input
              id="waitlist-name"
              onChange={(event) => setGuestName(event.target.value)}
              value={guestName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="waitlist-party">Comensales</FieldLabel>
            <Input
              id="waitlist-party"
              min={1}
              onChange={(event) => setPartySize(Number(event.target.value))}
              required
              type="number"
              value={partySize}
            />
          </Field>
          <Button disabled={feedback.pending} type="submit">
            Anotar en la lista
          </Button>
        </form>
        <FormFeedback pendingLabel="Actualizando la puerta…" state={feedback.state} />
      </CardContent>
    </Card>
  )
}
