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
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  createSeatReservationOperation,
  createCancelReservationOperation,
  createAddWaitlistOperation,
  createNoShowReservationOperation,
  createRemoveWaitlistOperation,
  createSeatWaitlistOperation,
  createServiceOfflineStore,
  enqueueServiceOperation,
  flushServiceOperations,
} from '../application/service-offline-operations'
import {
  cancelReservation,
  markReservationNoShow,
  seatReservation,
} from '../application/table-service'
import { addToWaitlist, removeFromWaitlist, seatWaitlistEntry } from '../application/waitlist'
import type { ServiceBoard } from '../domain/service-board'
import { describeTime } from './service-labels'

function reservationTableLabel(
  reservation: ServiceBoard['reservations'][number],
  board: ServiceBoard,
): string {
  const codes = new Map(board.tables.map((table) => [table.id, table.code]))
  const labels = reservation.tableIds.map((id) => codes.get(id)).filter(Boolean)
  return labels.length > 0 ? labels.join(', ') : 'Sin mesa'
}

function reservationTiming(startsAt: string, now: Date): { label: string; tone: string } {
  const minutes = (new Date(startsAt).getTime() - now.getTime()) / 60_000
  if (minutes < -15) return { label: 'Retrasada', tone: 'text-destructive' }
  if (minutes <= 30) return { label: 'Llega ahora', tone: 'text-amber-700' }
  return { label: 'Próxima', tone: 'text-muted-foreground' }
}

function canMarkNoShow(startsAt: string, now: Date): boolean {
  return now.getTime() - new Date(startsAt).getTime() >= 15 * 60_000
}

/** The door: bookings about to arrive and parties waiting without one. */
export function ServiceQueue({
  board,
  onDone,
  selectedTableIds,
  isOnline = true,
  now = new Date(0),
  tenantId,
  venueId,
}: {
  board: ServiceBoard
  onDone: () => void
  selectedTableIds: readonly string[]
  isOnline?: boolean
  now?: Date
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [estimatedWait, setEstimatedWait] = useState('')
  const [queueFilter, setQueueFilter] = useState<'all' | 'delayed' | 'upcoming'>('all')
  const offlineStore = useMemo(
    () => createServiceOfflineStore(tenantId, venueId),
    [tenantId, venueId],
  )

  useEffect(() => {
    const flush = () => {
      void flushServiceOperations(offlineStore).then((result) => {
        if (result.completed > 0) onDone()
      })
    }
    if (isOnline) flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [isOnline, onDone, offlineStore])
  const reservations = [...board.reservations]
    .filter((reservation) => {
      const minutes = (new Date(reservation.startsAt).getTime() - now.getTime()) / 60_000
      return queueFilter === 'all' || (queueFilter === 'delayed' ? minutes < -15 : minutes >= -15)
    })
    .sort(
      (left, right) =>
        Number(canMarkNoShow(right.startsAt, now)) - Number(canMarkNoShow(left.startsAt, now)) ||
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    )

  async function run(action: () => Promise<unknown>, message: string, onSuccess?: () => void) {
    if (feedback.pending) return
    if (!isOnline) {
      feedback.setError('Sin conexión: recupera la red antes de modificar la sala.')
      return
    }
    feedback.setPending()
    try {
      await action()
      onSuccess?.()
      onDone()
    } catch {
      feedback.setError(message)
    }
  }

  function addWaiting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isOnline) {
      enqueueServiceOperation(
        offlineStore,
        createAddWaitlistOperation({
          estimatedWaitMinutes: estimatedWait ? Number(estimatedWait) : null,
          ...(guestName ? { guestName } : {}),
          ...(guestPhone ? { guestPhone } : {}),
          partySize,
          tenantId,
          venueId,
        }),
      )
      feedback.setPending()
      feedback.setSuccess('Espera guardada. Se añadirá al recuperar la conexión.')
      setGuestName('')
      setGuestPhone('')
      setEstimatedWait('')
      setPartySize(2)
      return
    }
    void run(
      () =>
        addToWaitlist({
          data: {
            estimatedWaitMinutes: estimatedWait ? Number(estimatedWait) : null,
            ...(guestName ? { guestName } : {}),
            ...(guestPhone ? { guestPhone } : {}),
            partySize,
            tenantId,
            venueId,
          },
        }),
      'No se ha podido anotar la espera.',
      () => {
        setGuestName('')
        setGuestPhone('')
        setEstimatedWait('')
        setPartySize(2)
      },
    )
  }

  function seatReservationOffline(reservationId: string) {
    const operation = createSeatReservationOperation({ reservationId, tenantId, venueId })
    enqueueServiceOperation(offlineStore, operation)
    feedback.setPending()
    feedback.setSuccess('Reserva guardada. Se sentará automáticamente al recuperar la conexión.')
  }
  function transitionReservationOffline(kind: 'cancel' | 'no-show', reservationId: string) {
    enqueueServiceOperation(
      offlineStore,
      kind === 'cancel'
        ? createCancelReservationOperation({ reservationId, tenantId, venueId })
        : createNoShowReservationOperation({ reservationId, tenantId, venueId }),
    )
    feedback.setPending()
    feedback.setSuccess('Cambio guardado. Se aplicará al recuperar la conexión.')
  }
  function removeWaitlistOffline(waitlistEntryId: string) {
    enqueueServiceOperation(
      offlineStore,
      createRemoveWaitlistOperation({ waitlistEntryId, tenantId, venueId }),
    )
    feedback.setPending()
    feedback.setSuccess('Espera guardada. Se quitará al recuperar la conexión.')
  }

  function seatWaitlistOffline(waitlistEntryId: string) {
    enqueueServiceOperation(
      offlineStore,
      createSeatWaitlistOperation({
        tableIds: [...selectedTableIds],
        tenantId,
        venueId,
        waitlistEntryId,
      }),
    )
    feedback.setSuccess('Espera guardada. Se sentará automáticamente al recuperar la conexión.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Puerta</CardTitle>
        <CardDescription>Reservas de las próximas 12 horas y lista de espera.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Reservas del turno</h3>
            <label className="text-muted-foreground text-xs" htmlFor="queue-filter">
              Mostrar{' '}
              <select
                className="border-border text-foreground rounded-md border px-2 py-1"
                id="queue-filter"
                onChange={(event) => setQueueFilter(event.target.value as typeof queueFilter)}
                value={queueFilter}
              >
                <option value="all">Todas</option>
                <option value="delayed">Retrasadas</option>
                <option value="upcoming">Próximas</option>
              </select>
            </label>
          </div>
          {reservations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay reservas en las próximas horas.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {reservations.map((reservation) => (
                <li
                  key={reservation.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {describeTime(reservation.startsAt)} · {reservation.guestName ?? 'Sin nombre'}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {reservation.partySize} pax ·{' '}
                      {reservation.guestPhone ? (
                        <a
                          className="text-primary underline underline-offset-2"
                          href={`tel:${reservation.guestPhone}`}
                        >
                          {reservation.guestPhone}
                        </a>
                      ) : (
                        'Sin teléfono'
                      )}{' '}
                      · Mesa {reservationTableLabel(reservation, board)}
                    </span>
                  </span>
                  <output
                    aria-label={`Estado: ${reservationTiming(reservation.startsAt, now).label}`}
                    className={`shrink-0 text-xs font-medium ${reservationTiming(reservation.startsAt, now).tone}`}
                  >
                    {reservationTiming(reservation.startsAt, now).label}
                  </output>
                  <span className="flex max-w-full shrink flex-wrap justify-end gap-2">
                    <Button
                      disabled={feedback.pending}
                      onClick={() =>
                        isOnline
                          ? isOnline
                            ? void run(
                                () =>
                                  seatReservation({
                                    data: {
                                      reservationId: reservation.id,
                                      tenantId,
                                      venueId,
                                    },
                                  }),
                                'No se ha podido sentar la reserva.',
                              )
                            : transitionReservationOffline('no-show', reservation.id)
                          : seatReservationOffline(reservation.id)
                      }
                      type="button"
                    >
                      Sentar
                    </Button>
                    <Button
                      disabled={feedback.pending || !canMarkNoShow(reservation.startsAt, now)}
                      onClick={() =>
                        window.confirm('¿Marcar esta reserva como no presentada?')
                          ? isOnline
                            ? void run(
                                () =>
                                  markReservationNoShow({
                                    data: {
                                      reservationId: reservation.id,
                                      tenantId,
                                      venueId,
                                    },
                                  }),
                                'No se ha podido marcar como no presentada.',
                              )
                            : transitionReservationOffline('cancel', reservation.id)
                          : undefined
                      }
                      type="button"
                      variant="outline"
                    >
                      No-show
                    </Button>
                    <Button
                      disabled={feedback.pending}
                      onClick={() =>
                        window.confirm('¿Cancelar esta reserva y liberar su mesa?')
                          ? void run(
                              () =>
                                cancelReservation({
                                  data: {
                                    reservationId: reservation.id,
                                    tenantId,
                                    venueId,
                                  },
                                }),
                              'No se ha podido cancelar la reserva.',
                            )
                          : undefined
                      }
                      type="button"
                      variant="outline"
                    >
                      Cancelar
                    </Button>
                  </span>
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
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {`${entry.guestName ?? 'Sin nombre'} · ${entry.partySize} pax`}
                    {entry.guestPhone ? (
                      <a className="ml-2 underline" href={`tel:${entry.guestPhone}`}>
                        {entry.guestPhone}
                      </a>
                    ) : null}
                    {entry.estimatedWaitMinutes !== null ? (
                      <span className="text-muted-foreground ml-2">
                        {entry.estimatedWaitMinutes} min
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Button
                      disabled={feedback.pending || selectedTableIds.length === 0}
                      onClick={() =>
                        isOnline
                          ? void run(
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
                          : seatWaitlistOffline(entry.id)
                      }
                      type="button"
                    >
                      Sentar
                    </Button>
                    <Button
                      disabled={feedback.pending}
                      onClick={() =>
                        isOnline
                          ? void run(
                              () =>
                                removeFromWaitlist({
                                  data: {
                                    tenantId,
                                    venueId,
                                    waitlistEntryId: entry.id,
                                  },
                                }),
                              'No se ha podido quitar de la lista.',
                            )
                          : removeWaitlistOffline(entry.id)
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
            <FieldLabel htmlFor="waitlist-phone">Teléfono (opcional)</FieldLabel>
            <Input
              autoComplete="tel"
              id="waitlist-phone"
              inputMode="tel"
              onChange={(event) => setGuestPhone(event.target.value)}
              value={guestPhone}
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
          <Field>
            <FieldLabel htmlFor="waitlist-wait">Espera estimada (minutos, opcional)</FieldLabel>
            <Input
              id="waitlist-wait"
              inputMode="numeric"
              max={480}
              min={0}
              onChange={(event) => setEstimatedWait(event.target.value)}
              type="number"
              value={estimatedWait}
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
