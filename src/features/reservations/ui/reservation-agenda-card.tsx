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
  cn,
  useFormFeedback,
} from '@doscientos/ui'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { cancelReservation, markReservationNoShow } from '@/features/service'
import {
  calendarHours,
  calendarSlotFromY,
  calendarTop,
  weekDays,
} from '@/shared/lib/calendar/weekly-calendar'
import { zonedDateKey, zonedDateTimeParts, zonedLocalToIso } from '@/shared/lib/date/zoned-time'
import type { Locale } from '@/shared/lib/i18n/locale'
import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

import {
  getReservationEvents,
  getReservationsForDate,
  rescheduleReservation,
  type ReservationAgendaItem,
  type ReservationEvent,
} from '../application/reservations'
import { reservationStatusLabel } from '../domain/reservation-labels'
import type { ReservationAgendaSearch } from './reservation-page'

function canMarkNoShow(startsAt: string): boolean {
  return Date.now() - new Date(startsAt).getTime() >= 15 * 60_000
}

function dateOffset(days: number, timeZone: string): string {
  const date = new Date(`${zonedDateKey(new Date(), timeZone)}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function localDateTimeValue(value: string, timeZone: string): string {
  const parts = zonedDateTimeParts(new Date(value), timeZone)
  return `${parts.date}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

function statusBadgeClass(status: string): string {
  if (status === 'confirmed') return 'bg-success/15 text-success'
  if (status === 'seated') return 'bg-info/15 text-info'
  if (status === 'cancelled' || status === 'no_show') return 'bg-destructive/15 text-destructive'
  return 'bg-muted text-muted-foreground'
}

function calendarEventClass(status: string): string {
  if (status === 'confirmed') return 'border-success/30 bg-success/15 hover:bg-success/25'
  if (status === 'seated') return 'border-info/30 bg-info/15 hover:bg-info/25'
  if (status === 'cancelled' || status === 'no_show')
    return 'border-destructive/30 bg-destructive/10 text-muted-foreground hover:bg-destructive/15'
  return 'border-primary/30 bg-primary/10 hover:bg-primary/20'
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

export function ReservationAgendaCard({
  agendaSearch,
  locale,
  onSearchChange,
  tenantId,
  timezone,
  venueId,
  refreshToken = 0,
  onNewReservation,
  onCalendarSlotClick,
}: {
  agendaSearch?: ReservationAgendaSearch | undefined
  locale: Locale
  onSearchChange?: ((search: ReservationAgendaSearch) => void) | undefined
  tenantId: string
  timezone: string
  venueId: string
  refreshToken?: number
  onNewReservation?: () => void
  onCalendarSlotClick?: (value: string) => void
}) {
  const feedback = useFormFeedback()
  const { setError } = feedback
  const [agendaDate, setAgendaDate] = useState(
    () => agendaSearch?.date ?? zonedDateKey(new Date(), timezone),
  )
  const [query, setQuery] = useState(() => agendaSearch?.query ?? '')
  const [statusFilter, setStatusFilter] = useState<NonNullable<ReservationAgendaSearch['status']>>(
    () => agendaSearch?.status ?? 'all',
  )
  const [agenda, setAgenda] = useState<ReservationAgendaItem[]>([])
  const [weeklyAgenda, setWeeklyAgenda] = useState<Record<string, ReservationAgendaItem[]>>({})
  const [eventsByReservation, setEventsByReservation] = useState<
    Record<string, ReservationEvent[]>
  >({})
  const [expandedReservationId, setExpandedReservationId] = useState<string | null>(null)
  const [historyEventFilter, setHistoryEventFilter] = useState('all')
  const [agendaLoading, setAgendaLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [hoveredSlot, setHoveredSlot] = useState<{ date: string; top: number } | null>(null)
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
  const hasDeposits = agenda.some((item) => item.deposit !== null)
  const nowParts = zonedDateTimeParts(new Date(), timezone)
  const days = weekDays(agendaDate)
  const today = zonedDateKey(new Date(), timezone)
  const { end: calendarEnd, start: calendarStart } = calendarHours(weeklyAgenda, timezone)
  const calendarHourCount = calendarEnd - calendarStart
  const calendarHeight = calendarHourCount * 72
  const weekLabel = `${days[0]?.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })} – ${days[6]?.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`

  const visibleAgenda = agenda.filter((item) => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale)
    if (
      normalizedQuery &&
      ![item.guestName, item.guestPhone].some((value) =>
        value?.toLocaleLowerCase(locale).includes(normalizedQuery),
      )
    )
      return false
    if (statusFilter && statusFilter !== 'all' && item.status !== statusFilter) return false
    if (!hasDeposits || depositFilter === 'all') return true
    if (!item.deposit) return false
    if (depositFilter === 'pending') return item.deposit.status === 'pending'
    if (depositFilter === 'paid') return item.deposit.status === 'paid'
    return ['failed', 'partially_refunded'].includes(item.deposit.status)
  })

  function updateSearch(next: Partial<ReservationAgendaSearch>) {
    onSearchChange?.({
      date: next.date ?? agendaDate,
      query: next.query ?? query,
      status: next.status ?? statusFilter,
    })
  }

  function selectAgendaDate(date: string) {
    if (date !== agendaDate) {
      setAgendaLoading(true)
      setAgendaDate(date)
    }
    updateSearch({ date })
  }

  useEffect(() => {
    let cancelled = false
    void getReservationsForDate({ data: { date: agendaDate, tenantId, venueId } })
      .then((items) => {
        if (!cancelled) setAgenda(items)
      })
      .catch(() => {
        if (!cancelled) setAgenda([])
        if (!cancelled) setError('No se ha podido cargar la agenda.')
      })
      .finally(() => {
        if (!cancelled) setAgendaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agendaDate, agendaRefresh, refreshToken, setError, tenantId, venueId])

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      weekDays(agendaDate).map((day) => {
        const date = day.toISOString().slice(0, 10)
        return getReservationsForDate({ data: { date, tenantId, venueId } }).then(
          (items) => [date, items] as const,
        )
      }),
    )
      .then((entries) => {
        if (!cancelled) setWeeklyAgenda(Object.fromEntries(entries))
      })
      .catch(() => {
        if (!cancelled) {
          setWeeklyAgenda({})
          setError('No se ha podido cargar el calendario semanal.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [agendaDate, agendaRefresh, refreshToken, setError, tenantId, venueId])

  useAsyncEffect(() => {
    if (agendaSearch?.date && agendaSearch.date !== agendaDate) setAgendaDate(agendaSearch.date)
  }, [agendaSearch?.date, agendaDate])

  const refreshAgenda = useCallback(() => {
    setAgendaLoading(true)
    setAgendaRefresh((value) => value + 1)
  }, [])
  useAsyncEffect(() => {
    const interval = window.setInterval(() => {
      refreshAgenda()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [refreshAgenda])

  async function cancelAgendaReservation(reservationId: string) {
    if (feedback.pending) return
    feedback.setPending()
    try {
      const reason = transitionReason.trim() || undefined
      await cancelReservation({ data: { reservationId, reason, tenantId, venueId } })
      setReasonReservationId(null)
      setTransitionReason('')
      setAgendaLoading(true)
      setAgendaRefresh((value) => value + 1)
      feedback.setSuccess('Reserva cancelada. La agenda se ha actualizado.')
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
    if (feedback.pending) return
    feedback.setPending()
    try {
      const reason = transitionReason.trim() || undefined
      await markReservationNoShow({ data: { reservationId, reason, tenantId, venueId } })
      setReasonReservationId(null)
      setTransitionReason('')
      setAgendaLoading(true)
      setAgendaRefresh((value) => value + 1)
      feedback.setSuccess('Reserva marcada como no presentada. La agenda se ha actualizado.')
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
    if (feedback.pending) return
    feedback.setPending()
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
      feedback.setSuccess('Hora de la reserva actualizada.')
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
    <Card aria-busy={agendaLoading || feedback.pending}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Agenda semanal</CardTitle>
            <CardDescription className="mt-1 capitalize">{weekLabel}</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setViewMode('calendar')}
              size="sm"
              type="button"
              variant="ghost"
              aria-selected={viewMode === 'calendar'}
              className={cn(
                'rounded-none border-b-2 border-transparent',
                viewMode === 'calendar' && 'border-primary',
              )}
            >
              Calendario
            </Button>
            <Button
              onClick={() => setViewMode('list')}
              size="sm"
              type="button"
              variant="ghost"
              aria-selected={viewMode === 'list'}
              className={cn(
                'rounded-none border-b-2 border-transparent',
                viewMode === 'list' && 'border-primary',
              )}
            >
              Lista
            </Button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              aria-label="Semana anterior"
              onClick={() => {
                const date = shiftDate(agendaDate, -7)
                selectAgendaDate(date)
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              onClick={() => {
                const date = dateOffset(0, timezone)
                selectAgendaDate(date)
              }}
              size="default"
              type="button"
              variant="ghost"
            >
              Hoy
            </Button>
            <Button
              aria-label="Semana siguiente"
              onClick={() => {
                const date = shiftDate(agendaDate, 7)
                selectAgendaDate(date)
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Actualizar agenda"
              disabled={agendaLoading}
              onClick={() => {
                setAgendaLoading(true)
                setAgendaRefresh((value) => value + 1)
              }}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn(
                  'size-3.5',
                  agendaLoading && 'animate-spin motion-reduce:animate-none',
                )}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <FormFeedback pendingLabel="Actualizando agenda…" state={feedback.state} />
        <div className="grid gap-2 border-b pb-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field>
            <FieldLabel htmlFor="agenda-query">Buscar cliente</FieldLabel>
            <Input
              id="agenda-query"
              onChange={(event) => {
                setQuery(event.target.value)
                updateSearch({ query: event.target.value })
              }}
              placeholder="Nombre o teléfono"
              value={query}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="agenda-status">Estado</FieldLabel>
            <select
              className="border-border rounded-md border bg-transparent px-3 py-2 text-sm"
              id="agenda-status"
              onChange={(event) => {
                const value = (event.target.value || 'all') as NonNullable<
                  ReservationAgendaSearch['status']
                >
                setStatusFilter(value)
                updateSearch({ status: value })
              }}
              value={statusFilter}
            >
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="confirmed">Confirmadas</option>
              <option value="seated">Sentadas</option>
              <option value="cancelled">Canceladas</option>
              <option value="no_show">No presentadas</option>
            </select>
          </Field>
        </div>
        {viewMode === 'calendar' ? (
          <section
            aria-label="Calendario semanal"
            className="max-h-[calc(100vh-19rem)] overflow-auto rounded-lg border"
          >
            <div className="min-w-208">
              <div className="bg-background sticky top-0 z-30 grid grid-cols-[3.25rem_repeat(7,minmax(7rem,1fr))] border-b">
                <div aria-hidden="true" />
                {days.map((day) => {
                  const date = day.toISOString().slice(0, 10)
                  const selected = date === agendaDate
                  const isToday = date === today
                  return (
                    <button
                      aria-label={`Ver reservas del ${day.toLocaleDateString(locale, {
                        day: 'numeric',
                        month: 'long',
                      })}`}
                      className={cn(
                        'border-l px-2 py-3 text-center transition-colors hover:bg-muted/50',
                        selected && 'bg-primary/10',
                      )}
                      key={date}
                      onClick={() => {
                        selectAgendaDate(date)
                      }}
                      type="button"
                    >
                      <span className="text-muted-foreground block text-[11px] font-semibold uppercase">
                        {day.toLocaleDateString(locale, { weekday: 'short' })}
                      </span>
                      <span
                        className={cn(
                          'mx-auto mt-1 flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                          isToday && 'bg-primary text-primary-foreground',
                        )}
                      >
                        {day.getUTCDate()}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-[3.25rem_repeat(7,minmax(7rem,1fr))]">
                <div className="relative border-r" style={{ height: calendarHeight }}>
                  {Array.from({ length: calendarHourCount + 1 }, (_, index) => (
                    <span
                      className="text-muted-foreground absolute -top-2 right-2 text-[10px]"
                      key={calendarStart + index}
                      style={{ top: index * 72 }}
                    >
                      {String((calendarStart + index) % 24).padStart(2, '0')}:00
                    </span>
                  ))}
                </div>
                {days.map((day) => {
                  const date = day.toISOString().slice(0, 10)
                  return (
                    <div
                      className={cn(
                        'relative border-r last:border-r-0',
                        date === today && 'bg-primary/[0.03]',
                      )}
                      key={date}
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(to bottom, transparent 0, transparent 71px, hsl(var(--border) / 0.7) 72px)',
                        height: calendarHeight,
                      }}
                      onClick={(event) => {
                        if (!onCalendarSlotClick) return
                        const bounds = event.currentTarget.getBoundingClientRect()
                        const { hour, minute } = calendarSlotFromY(
                          event.clientY - bounds.top,
                          calendarStart,
                          calendarHourCount,
                        )
                        onCalendarSlotClick(
                          `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
                        )
                      }}
                      onMouseMove={(event) => {
                        const bounds = event.currentTarget.getBoundingClientRect()
                        const { hour, minute } = calendarSlotFromY(
                          event.clientY - bounds.top,
                          calendarStart,
                          calendarHourCount,
                        )
                        setHoveredSlot({
                          date,
                          top: calendarTop(hour, minute, calendarStart),
                        })
                      }}
                      onMouseLeave={() => setHoveredSlot(null)}
                    >
                      {onCalendarSlotClick
                        ? Array.from({ length: calendarHourCount * 4 }, (_, index) => {
                            const hour = calendarStart + Math.floor(index / 4)
                            const minute = (index % 4) * 15
                            return (
                              <button
                                aria-label={`Añadir reserva el ${date} a las ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
                                className="hover:bg-primary/10 absolute inset-x-0 z-[1] h-[18px] cursor-pointer"
                                key={`${date}-${hour}-${minute}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onCalendarSlotClick(
                                    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
                                  )
                                }}
                                style={{ top: index * 18 }}
                                type="button"
                              />
                            )
                          })
                        : null}
                      {hoveredSlot?.date === date ? (
                        <span
                          className="bg-primary/10 border-primary/30 pointer-events-none absolute inset-x-0 z-[5] h-[18px] border-y"
                          style={{ top: hoveredSlot.top }}
                        />
                      ) : null}
                      {date === today &&
                      nowParts.hour >= calendarStart &&
                      nowParts.hour <= calendarEnd ? (
                        <span
                          aria-label="Hora actual"
                          className="bg-primary pointer-events-none absolute inset-x-0 z-20 h-0.5"
                          style={{
                            top: calendarTop(nowParts.hour, nowParts.minute, calendarStart),
                          }}
                        />
                      ) : null}
                      {(weeklyAgenda[date] ?? []).map((item) => {
                        const parts = zonedDateTimeParts(new Date(item.startsAt), timezone)
                        const top = Math.max(
                          0,
                          calendarTop(parts.hour, parts.minute, calendarStart),
                        )
                        return (
                          <button
                            aria-label={`${parts.hour.toString().padStart(2, '0')}:${parts.minute.toString().padStart(2, '0')}, ${item.guestName ?? 'Sin nombre'}, ${item.partySize} comensales`}
                            className={cn(
                              'absolute inset-x-1 z-10 overflow-hidden rounded border px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              calendarEventClass(item.status),
                            )}
                            key={item.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              selectAgendaDate(date)
                            }}
                            style={{ height: 50, top }}
                            title={`${item.guestName ?? 'Sin nombre'} · ${item.partySize} comensales`}
                            type="button"
                          >
                            <span className="block truncate font-semibold">
                              {String(parts.hour).padStart(2, '0')}:
                              {String(parts.minute).padStart(2, '0')} ·{' '}
                              {item.guestName ?? 'Sin nombre'}
                            </span>
                            <span className="block truncate text-[10px] opacity-80">
                              {item.partySize} com. · {reservationStatusLabel(item.status)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        ) : null}
        {viewMode === 'list' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <h3 className="text-sm font-semibold">
              Reservas del{' '}
              {new Date(`${agendaDate}T12:00:00.000Z`).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'long',
                weekday: 'long',
              })}
            </h3>
            <output aria-live="polite" className="text-muted-foreground text-sm">
              {agendaLoading
                ? 'Cargando agenda…'
                : `${visibleAgenda.length} reserva${visibleAgenda.length === 1 ? '' : 's'}`}
            </output>
          </div>
        ) : null}
        {hasDeposits ? (
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
        ) : null}
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
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        statusBadgeClass(item.status),
                      )}
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
                      className={cn('mt-1 text-xs', {
                        'text-destructive font-medium': ['failed', 'partially_refunded'].includes(
                          item.deposit.status,
                        ),
                      })}
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
                    {expandedReservationId === item.id ? 'Ocultar historial' : 'Ver historial'}
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
                              (eventsByReservation[item.id] ?? []).map((event) => event.eventType),
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
                            historyEventFilter === 'all' || event.eventType === historyEventFilter,
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
                        reasonAction === 'cancel' ? 'Motivo de cancelación' : 'Motivo del no-show'
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
                        setEditingStartsAt(localDateTimeValue(item.startsAt, timezone))
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">No hay reservas para este día.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
