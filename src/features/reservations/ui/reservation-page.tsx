import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  DialogContent,
  DialogRoot,
  Field,
  FieldDescription,
  FieldLabel,
  FormFeedback,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
  Textarea,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type DragEvent, type FormEvent } from 'react'

import { zonedDateKey, zonedLocalToIso } from '@/shared/lib/date/zoned-time'
import type { Locale } from '@/shared/lib/i18n/locale'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import { reservationServiceErrorMessage } from '../application/reservation-service-error'
import {
  createReservation,
  createReservationService,
  exportReservationsCsv,
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
  agendaSearch,
  onAgendaSearchChange,
}: {
  services: readonly ReservationService[]
  tenantId: string
  venueId: string
  locale: Locale
  timezone: string
  terms: readonly ReservationTermsVersion[]
  agendaSearch?: ReservationAgendaSearch
  onAgendaSearchChange?: (search: ReservationAgendaSearch) => void
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
  const [reservationFileName, setReservationFileName] = useState('')
  const [isDraggingReservations, setIsDraggingReservations] = useState(false)
  const [reservationOperationId, setReservationOperationId] = useState(() => crypto.randomUUID())
  const [agendaRefreshToken, setAgendaRefreshToken] = useState(0)
  const [newReservationOpen, setNewReservationOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFrom, setExportFrom] = useState(() => zonedDateKey(new Date(), timezone))
  const [exportTo, setExportTo] = useState(() => zonedDateKey(new Date(), timezone))
  const [exporting, setExporting] = useState(false)

  async function exportReservations() {
    if (exportTo < exportFrom) {
      feedback.setError('El final de la exportación debe ser posterior al inicio.')
      return
    }
    setExporting(true)
    try {
      const content = await exportReservationsCsv({
        data: { from: exportFrom, tenantId, to: exportTo, venueId },
      })
      const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `sobretaula-reservas-${exportFrom}-${exportTo}.csv`
      link.click()
      URL.revokeObjectURL(url)
      feedback.setSuccess('CSV de reservas descargado.')
      setExportOpen(false)
    } catch {
      feedback.setError('No se ha podido exportar la agenda de reservas.')
    } finally {
      setExporting(false)
    }
  }

  async function loadReservationFile(file: File | undefined) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      feedback.setError('El archivo CSV no puede superar los 10 MB.')
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      feedback.setError('Selecciona un archivo CSV.')
      return
    }
    try {
      const contents = await file.text()
      setReservationCsv(contents)
      setReservationFileName(file.name)
      setReservationPreview(previewReservationCsv(contents))
    } catch {
      feedback.setError('No se ha podido leer el archivo CSV.')
    }
  }

  function dropReservations(event: DragEvent<HTMLInputElement>) {
    event.preventDefault()
    setIsDraggingReservations(false)
    void loadReservationFile(event.dataTransfer.files[0])
  }

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
    } catch (error) {
      feedback.setError(reservationServiceErrorMessage(error))
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
    let startsAtIso: string
    try {
      startsAtIso = zonedLocalToIso(startsAt, timezone)
    } catch {
      startsAtIso = ''
    }
    if (!serviceId || !startsAtIso || Number.isNaN(new Date(startsAtIso).getTime())) {
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
          startsAt: startsAtIso,
          operationId: reservationOperationId,
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Reserva creada y mesa asignada automáticamente.')
      setGuestName('')
      setGuestPhone('')
      setStartsAt('')
      setReservationOperationId(crypto.randomUUID())
      setNewReservationOpen(false)
      setAgendaRefreshToken((value) => value + 1)
      onAgendaSearchChange?.({ date: startsAt.slice(0, 10), query: '', status: 'all' })
    } catch {
      feedback.setError('No hay disponibilidad para esta petición.')
    }
  }

  const reload = useLoaderReload()
  const selectedService = services.find((service) => service.id === serviceId)

  return (
    <section className="space-y-6">
      <Tabs className="space-y-5" defaultSelectedKey="agenda">
        <PageHeader className="border-border/70 border-b pb-6">
          <div>
            <PageHeaderTitle>Reservas</PageHeaderTitle>
            <PageHeaderDescription>
              Organiza cada turno y asigna grupos a la mesa que mejor encaja.
            </PageHeaderDescription>
          </div>
          <div className="flex items-center gap-3">
            <TabsList aria-label="Secciones de reservas" className="w-fit">
              <TabsTrigger id="agenda">Agenda</TabsTrigger>
              <TabsTrigger id="turnos">Turnos</TabsTrigger>
            </TabsList>
            <Button onClick={() => setNewReservationOpen(true)} type="button">
              + Crear reserva
            </Button>
            <Button onClick={() => setExportOpen(true)} size="sm" type="button" variant="outline">
              Exportar
            </Button>
          </div>
        </PageHeader>
        <TabsPanels>
          <TabsContent id="agenda">
            <ReservationAgendaCard
              {...(agendaSearch ? { agendaSearch } : {})}
              locale={locale}
              {...(onAgendaSearchChange ? { onSearchChange: onAgendaSearchChange } : {})}
              refreshToken={agendaRefreshToken}
              tenantId={tenantId}
              timezone={timezone}
              venueId={venueId}
              onNewReservation={() => setNewReservationOpen(true)}
              onCalendarSlotClick={(value) => {
                setStartsAt(value)
                setNewReservationOpen(true)
              }}
            />
          </TabsContent>
          <TabsContent id="turnos">
            <details className="group">
              <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="text-lg leading-none transition-transform group-open:rotate-45">
                  +
                </span>
                Configuración secundaria: condiciones, importación y turnos
              </summary>
              <div className="mt-4 grid gap-6">
                <Card className="max-w-xl">
                  <CardHeader>
                    <CardTitle>Condiciones de reserva</CardTitle>
                    <CardDescription>
                      Escribe las normas que verá una persona antes de confirmar una reserva:
                      cancelaciones, retrasos, grupos o pagos. Al publicar se aplicarán a las
                      próximas reservas; las ya aceptadas conservarán la versión que aceptaron.
                    </CardDescription>
                    <CardDescription>
                      {terms[0]
                        ? `Versión activa: ${terms[0].version}. Publica de nuevo solo si necesitas cambiar las condiciones.`
                        : 'Aún no hay condiciones publicadas. Completa el título y el texto para activarlas en las reservas online.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-3" onSubmit={(event) => void publishTerms(event)}>
                      <Field>
                        <FieldLabel htmlFor="reservation-terms-title">Título</FieldLabel>
                        <Input
                          id="reservation-terms-title"
                          onChange={(event) => setTermsTitle(event.target.value)}
                          placeholder="Ej. Condiciones de reserva"
                          required
                          value={termsTitle}
                        />
                        <FieldDescription>
                          Se mostrará como encabezado de las condiciones.
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="reservation-terms-body">Texto</FieldLabel>
                        <Textarea
                          className="min-h-28"
                          id="reservation-terms-body"
                          onChange={(event) => setTermsBody(event.target.value)}
                          placeholder="Ej. Las reservas se mantienen durante 15 minutos…"
                          required
                          value={termsBody}
                        />
                        <FieldDescription>
                          Incluye solo normas que apliquéis realmente. Puedes modificarlo más
                          adelante: cada publicación crea una nueva versión.
                        </FieldDescription>
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
                      Suelta un CSV o selecciónalo. Se validará automáticamente y cada fila se
                      comprobará contra la disponibilidad real antes de crearla. Columnas: turno,
                      fecha_hora y comensales. Opcionales: nombre y telefono.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <label
                      aria-label="Seleccionar archivo CSV de reservas"
                      className={cn(
                        'grid min-h-24 cursor-pointer place-items-center rounded-lg border-2 border-dashed px-4 py-4 text-center text-sm',
                        isDraggingReservations
                          ? 'border-primary bg-primary/10'
                          : 'border-muted-foreground/30 hover:border-primary/60',
                      )}
                      htmlFor="reservation-csv-file"
                    >
                      <span>
                        <strong>{reservationFileName || 'Suelta el CSV aquí'}</strong>
                        <br />
                        <span className="text-muted-foreground">
                          {reservationFileName
                            ? 'Archivo cargado · puedes reemplazarlo'
                            : 'o haz clic para buscarlo'}
                        </span>
                      </span>
                      <input
                        accept=".csv,text/csv"
                        aria-label="Archivo CSV de reservas"
                        className="sr-only"
                        id="reservation-csv-file"
                        onDragEnter={(event) => {
                          event.preventDefault()
                          setIsDraggingReservations(true)
                        }}
                        onDragLeave={(event) => {
                          event.preventDefault()
                          setIsDraggingReservations(false)
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onChange={(event) => void loadReservationFile(event.target.files?.[0])}
                        onDrop={dropReservations}
                        type="file"
                      />
                    </label>
                    <textarea
                      aria-label="CSV de reservas futuras"
                      className="min-h-24 w-full rounded-md border px-3 py-2 font-mono text-xs"
                      onChange={(event) => {
                        setReservationCsv(event.target.value)
                        setReservationFileName('')
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
                          !reservationPreview ||
                          reservationPreview.errors.length > 0 ||
                          feedback.pending
                        }
                        onClick={() => {
                          if (!reservationPreview || reservationPreview.errors.length) return
                          feedback.setPending()
                          void importReservationCsv({
                            data: { csv: reservationCsv, tenantId, venueId },
                          })
                            .then((result) => {
                              feedback.setSuccess(`${result.imported} reservas importadas.`)
                              setReservationCsv('')
                              setReservationFileName('')
                              setReservationPreview(null)
                              reload()
                            })
                            .catch(() =>
                              feedback.setError('No se han podido importar las reservas.'),
                            )
                        }}
                        type="button"
                      >
                        Confirmar importación
                      </Button>
                    </div>
                    {reservationPreview ? (
                      <output className="text-sm">
                        {reservationPreview.rows.length} filas válidas ·{' '}
                        {reservationPreview.errors.length} errores
                        {reservationPreview.errors.length
                          ? ` (${reservationPreview.errors.map((item) => `fila ${item.row}: ${item.message}`).join('; ')})`
                          : ''}
                      </output>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </details>
            {services.length === 0 || editingServiceId ? (
              <Card className="max-w-xl">
                <CardHeader>
                  <CardTitle>
                    {editingServiceId ? 'Editar turno' : 'Configura el primer turno'}
                  </CardTitle>
                  <CardDescription>
                    Un turno es una regla semanal que se repite automáticamente. Por ejemplo, “Cena
                    · viernes” sirve para todos los viernes; no tienes que crear uno por cada fecha.
                    Las reservas solo se abrirán dentro del plazo máximo configurado (ahora mismo,
                    90 días).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={(event) => void configureService(event)}>
                    <Field>
                      <FieldLabel htmlFor="service-name">Nombre del turno</FieldLabel>
                      <Input
                        id="service-name"
                        onChange={(event) => setServiceName(event.target.value)}
                        placeholder="Ej. Comida o Cena"
                        required
                        value={serviceName}
                      />
                      <FieldDescription>
                        Pon un nombre fácil de reconocer, como “Comida” o “Cena”. Puedes repetirlo
                        en otros días.
                      </FieldDescription>
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
                      <FieldDescription>
                        Este turno se repetirá cada semana en el día elegido. Crea otro turno solo
                        si ese día tiene un horario o unas condiciones diferentes.
                      </FieldDescription>
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
                        <FieldDescription>
                          Hora a partir de la que se pueden reservar mesas.
                        </FieldDescription>
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
                        <FieldDescription>
                          Hora límite para iniciar reservas de este turno.
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="service-slot-minutes">
                          Intervalo entre reservas
                        </FieldLabel>
                        <Input
                          id="service-slot-minutes"
                          max={120}
                          min={5}
                          onChange={(event) => setServiceSlotMinutes(Number(event.target.value))}
                          placeholder="30"
                          required
                          type="number"
                          value={serviceSlotMinutes}
                        />
                        <FieldDescription>
                          Cada cuánto aparece una hora de llegada: con 30 minutos, por ejemplo,
                          20:00, 20:30 y 21:00. No es la duración de la comida.
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="service-max-covers">
                          Cubiertos máximos por intervalo
                        </FieldLabel>
                        <Input
                          id="service-max-covers"
                          min={1}
                          onChange={(event) => setServiceMaxCovers(Number(event.target.value))}
                          placeholder="20"
                          required
                          type="number"
                          value={serviceMaxCovers}
                        />
                        <FieldDescription>
                          Máximo de personas que pueden entrar en esa franja de llegada. Ejemplo: 20
                          permite aceptar 2 reservas de 10, pero no una de 21.
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="service-max-reservations">
                          Reservas máximas por intervalo
                        </FieldLabel>
                        <Input
                          id="service-max-reservations"
                          min={1}
                          onChange={(event) =>
                            setServiceMaxReservations(Number(event.target.value))
                          }
                          placeholder="4"
                          required
                          type="number"
                          value={serviceMaxReservations}
                        />
                        <FieldDescription>
                          Máximo de reservas que pueden empezar en esa misma franja, aunque aún
                          quede aforo. Ejemplo: 6 permite hasta 6 grupos cada 15 minutos.
                        </FieldDescription>
                      </Field>
                    </div>
                    <FormFeedback pendingLabel="Creando turno…" state={feedback.state} />
                    <Button disabled={feedback.pending} type="submit">
                      {editingServiceId ? 'Guardar cambios' : 'Crear turno'}
                    </Button>
                    {editingServiceId ? (
                      <Button
                        onClick={() => setEditingServiceId(null)}
                        type="button"
                        variant="ghost"
                      >
                        Cancelar
                      </Button>
                    ) : null}
                  </form>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>Turnos configurados</CardTitle>
                      <CardDescription>
                        Estas reglas se repiten cada semana y determinan cuándo se aceptan reservas
                        y cuánta capacidad se ofrece en cada intervalo. Para cerrar una fecha
                        concreta (festivo, vacaciones o evento), usa un bloqueo o cierre
                        excepcional.
                      </CardDescription>
                    </div>
                    <Button onClick={() => setEditingServiceId(null)} type="button">
                      Añadir turno
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {weekdays.map((weekdayName, weekdayIndex) => {
                        const weekdayServices = services.filter(
                          (service) => service.weekday === weekdayIndex,
                        )

                        return (
                          <li
                            className="bg-muted/20 min-h-32 rounded-lg border p-3"
                            key={weekdayName}
                          >
                            <p className="font-medium">{weekdayName}</p>
                            {weekdayServices.length > 0 ? (
                              <ul className="mt-2 grid gap-2">
                                {weekdayServices.map((service) => (
                                  <li
                                    className="bg-background rounded-md border p-3"
                                    key={service.id}
                                  >
                                    <p className="font-medium">{service.name}</p>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                      {service.startsAtTime.slice(0, 5)}–
                                      {service.endsAtTime.slice(0, 5)}
                                    </p>
                                    <p className="text-muted-foreground mt-2 text-xs">
                                      Cada {service.slotMinutes} min ·{' '}
                                      {service.maxCoversPerSlot ?? 'Aforo flexible'} cubiertos ·{' '}
                                      {service.maxReservationsPerSlot ?? 'Reservas flexibles'}{' '}
                                      reservas
                                    </p>
                                    <Button
                                      className="mt-3"
                                      onClick={() => loadService(service)}
                                      type="button"
                                      variant="outline"
                                    >
                                      Editar
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-muted-foreground mt-2 text-sm">Sin turnos</p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </CardContent>
                </Card>
                <DialogRoot onOpenChange={setNewReservationOpen} open={newReservationOpen}>
                  <DialogContent className="max-w-xl">
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
                        <FormFeedback
                          pendingLabel="Buscando disponibilidad…"
                          state={feedback.state}
                        />
                        <Button disabled={feedback.pending} type="submit">
                          Crear reserva
                        </Button>
                      </form>
                    </CardContent>
                  </DialogContent>
                </DialogRoot>
                <DialogRoot onOpenChange={setExportOpen} open={exportOpen}>
                  <DialogContent className="max-w-md">
                    <CardHeader>
                      <CardTitle>Exportar reservas</CardTitle>
                      <CardDescription>Descarga un CSV del periodo seleccionado.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="reservation-export-from">Desde</FieldLabel>
                          <Input
                            id="reservation-export-from"
                            onChange={(event) => setExportFrom(event.target.value)}
                            type="date"
                            value={exportFrom}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="reservation-export-to">Hasta</FieldLabel>
                          <Input
                            id="reservation-export-to"
                            onChange={(event) => setExportTo(event.target.value)}
                            type="date"
                            value={exportTo}
                          />
                        </Field>
                      </div>
                      <Button
                        disabled={exporting}
                        onClick={() => void exportReservations()}
                        type="button"
                      >
                        {exporting ? 'Preparando…' : 'Descargar CSV'}
                      </Button>
                    </CardContent>
                  </DialogContent>
                </DialogRoot>
              </>
            )}
          </TabsContent>
        </TabsPanels>
      </Tabs>
    </section>
  )
}

export interface ReservationAgendaSearch {
  date?: string
  query?: string
  status?: 'all' | 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show'
}
