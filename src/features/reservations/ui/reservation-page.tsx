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
  publishReservationTerms,
  type ReservationService,
  type ReservationTermsVersion,
} from '../application/reservations'
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
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [startsAt, setStartsAt] = useState('')
  const [termsTitle, setTermsTitle] = useState(terms[0]?.title ?? 'Condiciones de reserva')
  const [termsBody, setTermsBody] = useState(terms[0]?.body ?? '')

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
