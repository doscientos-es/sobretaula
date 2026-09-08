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
  PageHeaderTitle,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import {
  createReservation,
  createReservationService,
  type ReservationService,
} from '../application/reservations'

const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function ReservationPage({
  services,
  tenantId,
  venueId,
}: {
  services: readonly ReservationService[]
  tenantId: string
  venueId: string | undefined
}) {
  const feedback = useFormFeedback()
  const [serviceName, setServiceName] = useState('Comida')
  const [weekday, setWeekday] = useState(1)
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [guestName, setGuestName] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [startsAt, setStartsAt] = useState('')

  async function configureService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!venueId) return
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
      window.location.reload()
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
          partySize,
          serviceId,
          startsAt: date.toISOString(),
          tenantId,
        },
      })
      feedback.setSuccess('Reserva creada y mesa asignada automáticamente.')
    } catch {
      feedback.setError('No hay disponibilidad para esta petición.')
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeaderTitle>Reservas</PageHeaderTitle>
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
            {!venueId ? (
              <p className="text-muted-foreground text-sm">
                Crea primero un local y sus mesas desde Plano.
              </p>
            ) : (
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
            )}
          </CardContent>
        </Card>
      ) : (
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
              <FormFeedback pendingLabel="Buscando disponibilidad…" state={feedback.state} />
              <Button disabled={feedback.pending} type="submit">
                Crear reserva
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
