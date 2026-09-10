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
import { useEffect, useState, type FormEvent } from 'react'

import { cancelReservation, markReservationNoShow } from '@/features/service'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  createReservation,
  createReservationService,
  getReservationsForDate,
  type ReservationAgendaItem,
  type ReservationService,
} from '../application/reservations'
import { reservationStatusLabel } from '../domain/reservation-labels'

const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function canMarkNoShow(startsAt: string): boolean {
  return Date.now() - new Date(startsAt).getTime() >= 15 * 60_000
}

function dateOffset(days: number): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return new Intl.DateTimeFormat('en-CA').format(date)
}

function describeServiceRules(service: ReservationService): string {
  const covers = service.maxCoversPerSlot
    ? `${service.maxCoversPerSlot} cubiertos`
    : 'aforo flexible'
  const reservations = service.maxReservationsPerSlot
    ? `${service.maxReservationsPerSlot} reservas`
    : 'reservas flexibles'
  return `${service.slotMinutes} min · ${covers} · ${reservations} por hueco`
}

export function ReservationPage({
  services,
  tenantId,
  venueId,
}: {
  services: readonly ReservationService[]
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()
  const [serviceName, setServiceName] = useState('Comida')
  const [weekday, setWeekday] = useState(1)
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [startsAt, setStartsAt] = useState('')
  const [agendaDate, setAgendaDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [agenda, setAgenda] = useState<ReservationAgendaItem[]>([])
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [agendaRefresh, setAgendaRefresh] = useState(0)

  async function configureService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    try {
      await createReservationService({
        data: {
          endsAtTime: '16:00',
          maxCoversPerSlot: 20,
          maxReservationsPerSlot: 6,
          name: serviceName,
          slotMinutes: 15,
          startsAtTime: '13:00',
          tenantId,
          venueId,
          weekday,
        },
      })
      reload()
    } catch {
      feedback.setError('No se ha podido crear el turno. Comprueba que no esté duplicado.')
    }
  }

  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const date = new Date(startsAt)
    if (!serviceId || Number.isNaN(date.getTime())) {
      feedback.setError('Selecciona un turno y una fecha válida.')
      return
    }
    feedback.setPending()
    try {
      await createReservation({
        data: {
          ...(guestName ? { guestName } : {}),
          ...(guestPhone ? { guestPhone } : {}),
          partySize,
          serviceId,
          startsAt: date.toISOString(),
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Reserva creada y mesa asignada automáticamente.')
      setGuestName('')
      setGuestPhone('')
      setStartsAt('')
      reload()
    } catch {
      feedback.setError('No hay disponibilidad para esta petición.')
    }
  }

  const reload = useLoaderReload()
  const selectedService = services.find((service) => service.id === serviceId)

  useEffect(() => {
    let cancelled = false
    void getReservationsForDate({ data: { date: agendaDate, tenantId, venueId } })
      .then((items) => {
        if (!cancelled) setAgenda(items)
      })
      .catch(() => {
        if (!cancelled) setAgenda([])
      })
      .finally(() => {
        if (!cancelled) setAgendaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agendaDate, agendaRefresh, tenantId, venueId])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAgendaLoading(true)
      setAgendaRefresh((value) => value + 1)
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  async function cancelAgendaReservation(reservationId: string) {
    if (!window.confirm('¿Cancelar esta reserva?')) return
    try {
      await cancelReservation({ data: { reservationId, tenantId, venueId } })
      setAgendaLoading(true)
      setAgendaRefresh((value) => value + 1)
    } catch {
      feedback.setError('No se ha podido cancelar la reserva.')
    }
  }

  async function markAgendaNoShow(reservationId: string) {
    if (!window.confirm('¿Marcar esta reserva como no presentada?')) return
    try {
      await markReservationNoShow({ data: { reservationId, tenantId, venueId } })
      setAgendaLoading(true)
      setAgendaRefresh((value) => value + 1)
    } catch {
      feedback.setError('No se ha podido marcar como no presentada.')
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Reservas</PageHeaderTitle>
          <PageHeaderDescription>
            Organiza cada turno y asigna grupos a la mesa que mejor encaja.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      {services.length === 0 ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Configura el primer turno</CardTitle>
            <CardDescription>
              El pacing inicial admite 20 comensales y 6 reservas cada 15 minutos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void configureService(event)}>
              <Field>
                <FieldLabel htmlFor="service-name">Nombre del turno</FieldLabel>
                <Input
                  id="service-name"
                  onChange={(event) => setServiceName(event.target.value)}
                  required
                  value={serviceName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="service-weekday">Día de la semana</FieldLabel>
                <select
                  id="service-weekday"
                  onChange={(event) => setWeekday(Number(event.target.value))}
                  value={weekday}
                >
                  {weekdays.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <FormFeedback pendingLabel="Creando turno…" state={feedback.state} />
              <Button disabled={feedback.pending} type="submit">
                Crear turno
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Nueva reserva</CardTitle>
              <CardDescription>
                La asignación busca la mesa libre más pequeña que admite al grupo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={(event) => void reserve(event)}>
                <Field>
                  <FieldLabel htmlFor="reservation-service">Turno</FieldLabel>
                  <select
                    id="reservation-service"
                    onChange={(event) => setServiceId(event.target.value)}
                    required
                    value={serviceId}
                  >
                    {services.map((service) => (
                      <option
                        key={service.id}
                        value={service.id}
                      >{`${service.name} · ${weekdays[service.weekday]}`}</option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="reservation-time">Fecha y hora</FieldLabel>
                  <Input
                    id="reservation-time"
                    onChange={(event) => setStartsAt(event.target.value)}
                    required
                    type="datetime-local"
                    value={startsAt}
                  />
                  {selectedService ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      {describeServiceRules(selectedService)}
                    </p>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="reservation-party">Comensales</FieldLabel>
                  <Input
                    id="reservation-party"
                    min={1}
                    onChange={(event) => setPartySize(Number(event.target.value))}
                    required
                    type="number"
                    value={partySize}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reservation-guest">Nombre (opcional)</FieldLabel>
                  <Input
                    id="reservation-guest"
                    onChange={(event) => setGuestName(event.target.value)}
                    value={guestName}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reservation-phone">Teléfono (opcional)</FieldLabel>
                  <Input
                    autoComplete="tel"
                    id="reservation-phone"
                    onChange={(event) => setGuestPhone(event.target.value)}
                    value={guestPhone}
                  />
                </Field>
                <FormFeedback pendingLabel="Buscando disponibilidad…" state={feedback.state} />
                <Button disabled={feedback.pending} type="submit">
                  Crear reserva
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Agenda</CardTitle>
                <Button
                  disabled={agendaLoading}
                  onClick={() => {
                    setAgendaLoading(true)
                    setAgendaRefresh((value) => value + 1)
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Actualizar agenda
                </Button>
              </div>
              <CardDescription>Reservas del día seleccionado en este local.</CardDescription>
              <p className="text-muted-foreground text-xs">
                Se actualiza automáticamente cada minuto.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <FieldLabel htmlFor="agenda-date">Día</FieldLabel>
                <Input
                  id="agenda-date"
                  type="date"
                  value={agendaDate}
                  onChange={(event) => {
                    setAgendaLoading(true)
                    setAgendaDate(event.target.value)
                  }}
                />
                <div className="mt-2 flex gap-2">
                  {[
                    { label: 'Hoy', value: dateOffset(0) },
                    { label: 'Mañana', value: dateOffset(1) },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      onClick={() => {
                        setAgendaLoading(true)
                        setAgendaDate(option.value)
                      }}
                      size="sm"
                      type="button"
                      variant={agendaDate === option.value ? 'default' : 'outline'}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </Field>
              <output aria-live="polite" className="text-muted-foreground text-sm">
                {agendaLoading
                  ? 'Cargando agenda…'
                  : `${agenda.length} reserva${agenda.length === 1 ? '' : 's'}`}
              </output>
              {agenda.length > 0 ? (
                <ul className="grid gap-2">
                  {agenda.map((item) => (
                    <li
                      className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                      key={item.id}
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(item.startsAt).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          · {item.guestName ?? 'Sin nombre'}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {item.partySize} comensales · {reservationStatusLabel(item.status)}
                        </p>
                      </div>
                      <div className="text-muted-foreground text-right text-sm">
                        {item.guestPhone ? (
                          <a href={`tel:${item.guestPhone}`}>{item.guestPhone}</a>
                        ) : null}
                        <div>
                          {item.tableIds.length ? `Mesa ${item.tableIds.join(', ')}` : 'Sin mesa'}
                        </div>
                        {['pending', 'confirmed'].includes(item.status) ? (
                          <span className="mt-2 flex flex-wrap justify-end gap-2">
                            {canMarkNoShow(item.startsAt) ? (
                              <Button
                                disabled={feedback.pending}
                                onClick={() => void markAgendaNoShow(item.id)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                No-show
                              </Button>
                            ) : null}
                            <Button
                              disabled={feedback.pending}
                              onClick={() => void cancelAgendaReservation(item.id)}
                              size="sm"
                              type="button"
                            >
                              Cancelar
                            </Button>
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : !agendaLoading ? (
                <p className="text-muted-foreground text-sm">No hay reservas para este día.</p>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}
