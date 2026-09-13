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
import { useState, type FormEvent } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  createReservation,
  createReservationService,
  importReservationCsv,
  publishReservationTerms,
  type ReservationService,
  type ReservationTermsVersion,
  updateReservationService,
} from '../application/reservations'
import { previewReservationCsv, type ReservationImportPreview } from '../domain/reservation-import'
import { ReservationAgendaCard } from './reservation-agenda-card'

const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

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
  const [serviceStartsAt, setServiceStartsAt] = useState('13:00')
  const [serviceEndsAt, setServiceEndsAt] = useState('16:00')
  const [serviceSlotMinutes, setServiceSlotMinutes] = useState(15)
  const [serviceMaxCovers, setServiceMaxCovers] = useState(20)
  const [serviceMaxReservations, setServiceMaxReservations] = useState(6)
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [startsAt, setStartsAt] = useState('')
  const [termsTitle, setTermsTitle] = useState(terms[0]?.title ?? 'Condiciones de reserva')
  const [termsBody, setTermsBody] = useState(terms[0]?.body ?? '')
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [reservationCsv, setReservationCsv] = useState('')
  const [reservationPreview, setReservationPreview] = useState<ReservationImportPreview | null>(
    null,
  )

  function loadService(service: ReservationService) {
    setEditingServiceId(service.id)
    setServiceName(service.name)
    setWeekday(service.weekday)
    setServiceStartsAt(service.startsAtTime.slice(0, 5))
    setServiceEndsAt(service.endsAtTime.slice(0, 5))
    setServiceSlotMinutes(service.slotMinutes)
    setServiceMaxCovers(service.maxCoversPerSlot ?? 1)
    setServiceMaxReservations(service.maxReservationsPerSlot ?? 1)
  }

  async function configureService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (serviceEndsAt <= serviceStartsAt) {
      feedback.setError('La hora de cierre debe ser posterior a la de apertura.')
      return
    }
    if (serviceSlotMinutes < 5 || serviceSlotMinutes > 120) {
      feedback.setError('El intervalo debe estar entre 5 y 120 minutos.')
      return
    }
    feedback.setPending()
    try {
      const payload = {
        endsAtTime: serviceEndsAt,
        maxCoversPerSlot: serviceMaxCovers,
        maxReservationsPerSlot: serviceMaxReservations,
        name: serviceName,
        slotMinutes: serviceSlotMinutes,
        startsAtTime: serviceStartsAt,
        tenantId,
        venueId,
        weekday,
      }
      if (editingServiceId) {
        await updateReservationService({
          data: { ...payload, serviceId: editingServiceId },
        })
      } else {
        await createReservationService({ data: payload })
      }
      setEditingServiceId(null)
      reload()
    } catch {
      feedback.setError('No se ha podido guardar el turno. Comprueba los datos.')
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
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Importar reservas futuras</CardTitle>
          <CardDescription>
            Columnas: turno, fecha_hora y comensales. Opcionales: nombre y telefono. Cada fila se
            comprobará contra la disponibilidad real antes de crearla.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <textarea
            aria-label="CSV de reservas futuras"
            className="min-h-24 w-full rounded-md border px-3 py-2 font-mono text-xs"
            onChange={(event) => {
              setReservationCsv(event.target.value)
              setReservationPreview(null)
            }}
            placeholder="turno;fecha_hora;comensales;nombre;telefono"
            value={reservationCsv}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!reservationCsv.trim() || feedback.pending}
              onClick={() => setReservationPreview(previewReservationCsv(reservationCsv))}
              type="button"
              variant="outline"
            >
              Validar CSV
            </Button>
            <Button
              disabled={
                !reservationPreview || reservationPreview.errors.length > 0 || feedback.pending
              }
              onClick={() => {
                if (!reservationPreview || reservationPreview.errors.length) return
                feedback.setPending()
                void importReservationCsv({ data: { csv: reservationCsv, tenantId, venueId } })
                  .then((result) => {
                    feedback.setSuccess(`${result.imported} reservas importadas.`)
                    setReservationCsv('')
                    setReservationPreview(null)
                    reload()
                  })
                  .catch(() => feedback.setError('No se han podido importar las reservas.'))
              }}
              type="button"
            >
              Confirmar importación
            </Button>
          </div>
          {reservationPreview ? (
            <output className="text-sm">
              {reservationPreview.rows.length} filas válidas · {reservationPreview.errors.length}{' '}
              errores
              {reservationPreview.errors.length
                ? ` (${reservationPreview.errors.map((item) => `fila ${item.row}: ${item.message}`).join('; ')})`
                : ''}
            </output>
          ) : null}
        </CardContent>
      </Card>
      {services.length === 0 || editingServiceId ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{editingServiceId ? 'Editar turno' : 'Configura el primer turno'}</CardTitle>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="service-starts-at">Apertura del turno</FieldLabel>
                  <Input
                    id="service-starts-at"
                    onChange={(event) => setServiceStartsAt(event.target.value)}
                    required
                    type="time"
                    value={serviceStartsAt}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="service-ends-at">Cierre del turno</FieldLabel>
                  <Input
                    id="service-ends-at"
                    onChange={(event) => setServiceEndsAt(event.target.value)}
                    required
                    type="time"
                    value={serviceEndsAt}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="service-slot-minutes">Intervalo entre reservas</FieldLabel>
                  <Input
                    id="service-slot-minutes"
                    max={120}
                    min={5}
                    onChange={(event) => setServiceSlotMinutes(Number(event.target.value))}
                    required
                    type="number"
                    value={serviceSlotMinutes}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="service-max-covers">
                    Cubiertos máximos por intervalo
                  </FieldLabel>
                  <Input
                    id="service-max-covers"
                    min={1}
                    onChange={(event) => setServiceMaxCovers(Number(event.target.value))}
                    required
                    type="number"
                    value={serviceMaxCovers}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="service-max-reservations">
                    Reservas máximas por intervalo
                  </FieldLabel>
                  <Input
                    id="service-max-reservations"
                    min={1}
                    onChange={(event) => setServiceMaxReservations(Number(event.target.value))}
                    required
                    type="number"
                    value={serviceMaxReservations}
                  />
                </Field>
              </div>
              <FormFeedback pendingLabel="Creando turno…" state={feedback.state} />
              <Button disabled={feedback.pending} type="submit">
                {editingServiceId ? 'Guardar cambios' : 'Crear turno'}
              </Button>
              {editingServiceId ? (
                <Button onClick={() => setEditingServiceId(null)} type="button" variant="ghost">
                  Cancelar
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Turnos configurados</CardTitle>
              <CardDescription>
                Estas reglas determinan cuándo se aceptan reservas y cuánta capacidad se ofrece.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-2">
                {services.map((service) => (
                  <li className="rounded-lg border p-4" key={service.id}>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {weekdays[service.weekday]} · {service.startsAtTime.slice(0, 5)}–
                      {service.endsAtTime.slice(0, 5)}
                    </p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Cada {service.slotMinutes} min ·{' '}
                      {service.maxCoversPerSlot ?? 'Aforo flexible'} cubiertos ·{' '}
                      {service.maxReservationsPerSlot ?? 'Reservas flexibles'} reservas por
                      intervalo
                    </p>
                    <Button
                      className="mt-3"
                      onClick={() => loadService(service)}
                      type="button"
                      variant="outline"
                    >
                      Editar turno
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
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
          <ReservationAgendaCard
            locale={locale}
            tenantId={tenantId}
            timezone={timezone}
            venueId={venueId}
          />
        </>
      )}
    </section>
  )
}
