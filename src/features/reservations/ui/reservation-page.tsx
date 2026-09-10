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

import { zonedLocalToIso } from '@/features/public-reservations/domain/zoned-time'
import { cancelReservation, markReservationNoShow } from '@/features/service'
import type { Locale } from '@/shared/lib/i18n/locale'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  createReservation,
  createReservationService,
  getReservationsForDate,
  getReservationEvents,
  publishReservationTerms,
  rescheduleReservation,
  type ReservationAgendaItem,
  type ReservationEvent,
  type ReservationService,
  type ReservationTermsVersion,
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

function localDateTimeValue(value: string): string {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
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

function statusBadgeClass(status: string): string {
  if (status === 'confirmed') return 'bg-success/15 text-success'
  if (status === 'seated') return 'bg-info/15 text-info'
  if (status === 'cancelled' || status === 'no_show') return 'bg-destructive/15 text-destructive'
  return 'bg-muted text-muted-foreground'
}

function describeEventChanges(changes: string): string | null {
  try {
    const parsed = JSON.parse(changes) as Record<string, unknown>
    const entries = Object.entries(parsed).filter(([, value]) => value !== undefined)
    if (entries.length === 0) return null
    return entries
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === 'string' ? value : (JSON.stringify(value) ?? '—')}`,
      )
      .join(' · ')
  } catch {
    return null
  }
}

export function ReservationPage({
  services,
  tenantId,
  venueId,
  locale,
  timezone,
  terms,
}: {
  services: readonly ReservationService[]
  tenantId: string
  venueId: string
  locale: Locale
  timezone: string
  terms: readonly ReservationTermsVersion[]
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
  const [eventsByReservation, setEventsByReservation] = useState<
    Record<string, ReservationEvent[]>
  >({})
  const [expandedReservationId, setExpandedReservationId] = useState<string | null>(null)
  const [historyEventFilter, setHistoryEventFilter] = useState('all')
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [agendaRefresh, setAgendaRefresh] = useState(0)
  const [depositFilter, setDepositFilter] = useState<'all' | 'pending' | 'paid' | 'attention'>(
    'all',
  )
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null)
  const [reasonReservationId, setReasonReservationId] = useState<string | null>(null)
  const [reasonAction, setReasonAction] = useState<'cancel' | 'no-show'>('cancel')
  const [transitionReason, setTransitionReason] = useState('')
  const [editingStartsAt, setEditingStartsAt] = useState('')
  const [editingPartySize, setEditingPartySize] = useState(1)
  const [termsTitle, setTermsTitle] = useState(terms[0]?.title ?? 'Condiciones de reserva')
  const [termsBody, setTermsBody] = useState(terms[0]?.body ?? '')
  const visibleAgenda = agenda.filter((item) => {
    if (depositFilter === 'all') return true
    if (!item.deposit) return false
    if (depositFilter === 'pending') return item.deposit.status === 'pending'
    if (depositFilter === 'paid') return item.deposit.status === 'paid'
    return ['failed', 'partially_refunded'].includes(item.deposit.status)
  })

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

  async function publishTerms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    try {
      await publishReservationTerms({
        data: { body: termsBody, tenantId, title: termsTitle, venueId },
      })
      feedback.setSuccess('Nueva versión de condiciones publicada.')
      reload()
    } catch {
      feedback.setError('No se han podido publicar las condiciones.')
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
    try {
      const reason = transitionReason.trim() || undefined
      await cancelReservation({ data: { reservationId, reason, tenantId, venueId } })
      setReasonReservationId(null)
      setTransitionReason('')
      setAgendaLoading(true)
      setAgendaRefresh((value) => value + 1)
    } catch {
      feedback.setError('No se ha podido cancelar la reserva.')
    }
  }

  async function toggleReservationHistory(item: ReservationAgendaItem) {
    if (expandedReservationId === item.id) {
      setExpandedReservationId(null)
      return
    }
    setExpandedReservationId(item.id)
    if (eventsByReservation[item.id]) return
    try {
      const events = await getReservationEvents({
        data: { reservationId: item.id, tenantId, venueId },
      })
      setEventsByReservation((current) => ({ ...current, [item.id]: events }))
    } catch {
      feedback.setError('No se pudo cargar el historial de la reserva.')
    }
  }

  async function markAgendaNoShow(reservationId: string) {
    try {
      const reason = transitionReason.trim() || undefined
      await markReservationNoShow({ data: { reservationId, reason, tenantId, venueId } })
      setReasonReservationId(null)
      setTransitionReason('')
      setAgendaLoading(true)
      setAgendaRefresh((value) => value + 1)
    } catch {
      feedback.setError('No se ha podido marcar como no presentada.')
    }
  }

  async function saveReschedule(reservationId: string) {
    const startsAt = new Date(editingStartsAt)
    if (Number.isNaN(startsAt.getTime())) {
      feedback.setError('Indica una fecha y hora válidas.')
      return
    }
    try {
      await rescheduleReservation({
        data: {
          partySize: editingPartySize,
          reservationId,
          startsAt: zonedLocalToIso(editingStartsAt, timezone),
          tenantId,
          venueId,
        },
      })
      setEditingReservationId(null)
      setAgendaDate(editingStartsAt.slice(0, 10))
      setAgendaLoading(true)
      setAgendaRefresh((value) => value + 1)
    } catch (error) {
      feedback.setError(
        error instanceof Response && error.status === 409
          ? 'La mesa ya está ocupada en esa hora.'
          : error instanceof Response && error.status === 422
            ? 'La mesa no admite tantos comensales o el turno no es válido.'
            : 'No se ha podido cambiar la reserva.',
      )
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
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Condiciones de reserva</CardTitle>
          <CardDescription>
            Cada publicación crea una versión nueva y queda congelada en las reservas aceptadas.
            {terms[0]
              ? ` Versión activa: ${terms[0].version}.`
              : ' Todavía no hay una versión publicada.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => void publishTerms(event)}>
            <Field>
              <FieldLabel htmlFor="reservation-terms-title">Título</FieldLabel>
              <Input
                id="reservation-terms-title"
                onChange={(event) => setTermsTitle(event.target.value)}
                required
                value={termsTitle}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="reservation-terms-body">Texto</FieldLabel>
              <textarea
                className="min-h-28 w-full rounded-md border px-3 py-2"
                id="reservation-terms-body"
                onChange={(event) => setTermsBody(event.target.value)}
                required
                value={termsBody}
              />
            </Field>
            <Button disabled={feedback.pending} type="submit">
              Publicar nueva versión
            </Button>
          </form>
        </CardContent>
      </Card>
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
                  : `${visibleAgenda.length} reserva${visibleAgenda.length === 1 ? '' : 's'}`}
              </output>
              <label className="text-muted-foreground flex items-center gap-2 text-sm">
                Depósito{' '}
                <select
                  aria-label="Filtrar por depósito"
                  className="border-border rounded-md border bg-transparent px-2 py-1"
                  onChange={(event) => setDepositFilter(event.target.value as typeof depositFilter)}
                  value={depositFilter}
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="paid">Pagados</option>
                  <option value="attention">Requieren atención</option>
                </select>
              </label>
              {visibleAgenda.length > 0 ? (
                <ul className="grid gap-2">
                  {visibleAgenda.map((item) => (
                    <li
                      className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                      key={item.id}
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(item.startsAt).toLocaleTimeString(locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          · {item.guestName ?? 'Sin nombre'}
                        </p>
                        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                          <span>{item.partySize} comensales</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}
                          >
                            {reservationStatusLabel(item.status)}
                          </span>
                        </p>
                      </div>
                      <div className="text-muted-foreground text-right text-sm">
                        {item.guestPhone ? (
                          <a href={`tel:${item.guestPhone}`}>{item.guestPhone}</a>
                        ) : null}
                        <div>
                          {item.tableIds.length ? `Mesa ${item.tableIds.join(', ')}` : 'Sin mesa'}
                        </div>
                        {item.deposit ? (
                          <div
                            className={`mt-1 text-xs ${['failed', 'partially_refunded'].includes(item.deposit.status) ? 'text-destructive font-medium' : ''}`}
                          >
                            Depósito: {(item.deposit.amountCents / 100).toFixed(2)} € ·{' '}
                            {item.deposit.status}
                          </div>
                        ) : null}
                        <Button
                          className="mt-2"
                          onClick={() => void toggleReservationHistory(item)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {expandedReservationId === item.id
                            ? 'Ocultar historial'
                            : 'Ver historial'}
                        </Button>
                        {expandedReservationId === item.id ? (
                          <div className="mt-2 space-y-2 text-left text-xs">
                            <label className="text-muted-foreground flex items-center gap-2">
                              Tipo
                              <select
                                className="border-border text-foreground rounded-md border px-2 py-1"
                                onChange={(event) => setHistoryEventFilter(event.target.value)}
                                value={historyEventFilter}
                              >
                                <option value="all">Todos</option>
                                {[
                                  ...new Set(
                                    (eventsByReservation[item.id] ?? []).map(
                                      (event) => event.eventType,
                                    ),
                                  ),
                                ].map((eventType) => (
                                  <option key={eventType} value={eventType}>
                                    {eventType}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <ol className="border-border grid gap-1 border-l pl-3">
                              {(eventsByReservation[item.id] ?? [])
                                .filter(
                                  (event) =>
                                    historyEventFilter === 'all' ||
                                    event.eventType === historyEventFilter,
                                )
                                .map((event) => (
                                  <li key={`${event.createdAt}-${event.eventType}`}>
                                    <span className="font-medium">{event.eventType}</span>{' '}
                                    <span className="text-muted-foreground">
                                      · {new Date(event.createdAt).toLocaleString(locale)} ·{' '}
                                      {event.actorKind}
                                    </span>
                                    {describeEventChanges(event.changes) ? (
                                      <span className="text-muted-foreground block">
                                        {describeEventChanges(event.changes)}
                                      </span>
                                    ) : null}
                                    {event.reason ? (
                                      <span className="text-muted-foreground block">
                                        Motivo: {event.reason}
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              {!eventsByReservation[item.id]?.filter(
                                (event) =>
                                  historyEventFilter === 'all' ||
                                  event.eventType === historyEventFilter,
                              ).length ? (
                                <li>
                                  {eventsByReservation[item.id]
                                    ? 'No hay eventos para este filtro.'
                                    : 'Cargando historial…'}
                                </li>
                              ) : null}
                            </ol>
                          </div>
                        ) : null}
                        {['pending', 'confirmed'].includes(item.status) ? (
                          <span className="mt-2 flex flex-wrap justify-end gap-2">
                            {canMarkNoShow(item.startsAt) ? (
                              <Button
                                disabled={feedback.pending}
                                onClick={() => {
                                  setReasonAction('no-show')
                                  setTransitionReason('')
                                  setReasonReservationId(item.id)
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                No-show
                              </Button>
                            ) : null}
                            <Button
                              disabled={feedback.pending}
                              onClick={() => {
                                setReasonAction('cancel')
                                setTransitionReason('')
                                setReasonReservationId(item.id)
                              }}
                              size="sm"
                              type="button"
                            >
                              Cancelar
                            </Button>
                          </span>
                        ) : null}
                        {reasonReservationId === item.id ? (
                          <form
                            aria-label={
                              reasonAction === 'cancel'
                                ? 'Motivo de cancelación'
                                : 'Motivo del no-show'
                            }
                            className="mt-2 grid gap-2"
                            onSubmit={(event) => {
                              event.preventDefault()
                              void (reasonAction === 'cancel'
                                ? cancelAgendaReservation(item.id)
                                : markAgendaNoShow(item.id))
                            }}
                          >
                            <Field>
                              <FieldLabel htmlFor={`transition-reason-${item.id}`}>
                                Motivo (opcional)
                              </FieldLabel>
                              <Input
                                id={`transition-reason-${item.id}`}
                                maxLength={500}
                                onChange={(event) => setTransitionReason(event.target.value)}
                                value={transitionReason}
                              />
                            </Field>
                            <span className="flex flex-wrap justify-end gap-2">
                              <Button disabled={feedback.pending} type="submit">
                                {reasonAction === 'cancel'
                                  ? 'Confirmar cancelación'
                                  : 'Confirmar no-show'}
                              </Button>
                              <Button
                                onClick={() => setReasonReservationId(null)}
                                type="button"
                                variant="outline"
                              >
                                Volver
                              </Button>
                            </span>
                          </form>
                        ) : null}
                        {editingReservationId === item.id ? (
                          <div className="mt-2 grid gap-2">
                            <Input
                              aria-label="Nueva fecha y hora"
                              onChange={(event) => setEditingStartsAt(event.target.value)}
                              type="datetime-local"
                              value={editingStartsAt}
                            />
                            <Input
                              aria-label="Número de comensales"
                              max={50}
                              min={1}
                              onChange={(event) => setEditingPartySize(Number(event.target.value))}
                              type="number"
                              value={editingPartySize}
                            />
                            <span className="flex flex-wrap justify-end gap-2">
                              <Button
                                disabled={feedback.pending}
                                onClick={() => void saveReschedule(item.id)}
                                size="sm"
                                type="button"
                              >
                                Guardar hora
                              </Button>
                              <Button
                                onClick={() => setEditingReservationId(null)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Cancelar edición
                              </Button>
                            </span>
                          </div>
                        ) : ['pending', 'confirmed'].includes(item.status) ? (
                          <Button
                            className="mt-2"
                            onClick={() => {
                              setEditingReservationId(item.id)
                              setEditingStartsAt(localDateTimeValue(item.startsAt))
                              setEditingPartySize(item.partySize)
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Cambiar hora
                          </Button>
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
