import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  useFormFeedback,
  FormFeedback,
  Input,
} from '@doscientos/ui'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  getTimekeepingAdvancedReport,
  createWorkforceShift,
  saveWorkforceAvailability,
  createWorkforceAbsence,
  updateWorkforceShiftStatus,
  recordTimeEvent,
  saveTimekeepingHoliday,
  saveTimekeepingRate,
  saveTimekeepingTerm,
  saveTimekeepingVenueAssignments,
  setMyTimekeepingPin,
  type getTimekeepingConfiguration,
  type getMyTimekeeping,
} from '../application/timekeeping'
import {
  createTimekeepingOfflineOperation,
  createTimekeepingOfflineStore,
  enqueueTimekeepingOperation,
  flushTimekeepingOperations,
} from '../application/timekeeping-offline-operations'
import { recommendStaffing } from '../domain/staffing-recommendation'
import { allowedNextEvent, type TimeEventType } from '../domain/timekeeping'

const labels: Record<TimeEventType, string> = {
  clock_in: 'Entrar',
  break_start: 'Iniciar pausa',
  break_end: 'Terminar pausa',
  clock_out: 'Salir',
}

function formText(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

export function TimekeepingPage({
  summary,
  employeeId,
  tenantId,
  venueId,
  management,
  onDone,
}: {
  management: Awaited<ReturnType<typeof getTimekeepingConfiguration>> | null
  summary: Awaited<ReturnType<typeof getMyTimekeeping>>
  employeeId: string
  tenantId: string
  venueId: string
  onDone: () => void
}) {
  const feedback = useFormFeedback()
  const [pin, setPin] = useState('')
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const offlineStore = useMemo(
    () => createTimekeepingOfflineStore(tenantId, venueId),
    [tenantId, venueId],
  )
  const [pendingOffline, setPendingOffline] = useState(() => offlineStore.read().length)
  const queuedEvents = offlineStore
    .read()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const last = queuedEvents.at(-1)?.payload.eventType ?? summary.events.at(-1)?.eventType ?? null
  const next = allowedNextEvent(last)

  useEffect(() => {
    const flush = () => {
      setIsOnline(true)
      void flushTimekeepingOperations(offlineStore).then((result) => {
        setPendingOffline(offlineStore.read().length)
        if (result.completed > 0) onDone()
      })
    }
    const offline = () => setIsOnline(false)
    if (isOnline) flush()
    window.addEventListener('online', flush)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', flush)
      window.removeEventListener('offline', offline)
    }
  }, [isOnline, offlineStore, onDone])

  function queueEvent(eventType: TimeEventType) {
    const operation = createTimekeepingOfflineOperation({
      clientOccurredAt: new Date().toISOString(),
      employeeId,
      eventType,
      operationId: crypto.randomUUID(),
      tenantId,
      venueId,
    })
    enqueueTimekeepingOperation(offlineStore, operation)
    setPendingOffline(offlineStore.read().length)
    feedback.setSuccess(
      'Fichaje guardado en este dispositivo. Se sincronizará al recuperar la conexión.',
    )
  }

  async function savePin() {
    feedback.setPending()
    try {
      await setMyTimekeepingPin({ data: { pin, tenantId, venueId } })
      setPin('')
      feedback.setSuccess('PIN actualizado. Ya puedes usar el terminal compartido.')
    } catch {
      feedback.setError('No se ha podido actualizar el PIN. Usa entre 4 y 8 cifras.')
    }
  }
  return (
    <section className="space-y-6">
      <PageHeader>
        <div>
          <PageHeaderTitle>Fichaje</PageHeaderTitle>
          <PageHeaderDescription>Registra tu jornada desde este terminal.</PageHeaderDescription>
        </div>
      </PageHeader>
      <Card aria-busy={feedback.pending} className="max-w-xl">
        <CardHeader>
          <CardTitle>{last ? `Último estado: ${labels[last]}` : 'Sin jornada iniciada'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-semibold">{summary.workedMinutes} min trabajados</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Nocturnidad" value={`${summary.laborSummary.nightMinutes} min`} />
            <Metric label="Festivos" value={`${summary.laborSummary.holidayMinutes} min`} />
            <Metric
              label={
                summary.laborContext.employmentType === 'part_time' ? 'Complementarias' : 'Extras'
              }
              value={`${summary.laborSummary.complementaryMinutes + summary.laborSummary.overtimeMinutes} min`}
            />
            <Metric
              label="Incidencias"
              value={`${summary.laborSummary.breakViolationCount + summary.laborSummary.restViolationCount}`}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Resumen orientativo según las condiciones configuradas. No sustituye la revisión de
            convenio ni la nómina.
          </p>
          <div className="flex flex-wrap gap-3">
            {next.map((eventType) => (
              <Button
                key={eventType}
                disabled={feedback.pending}
                onClick={() => {
                  feedback.setPending()
                  if (!isOnline) {
                    queueEvent(eventType)
                    return
                  }
                  void recordTimeEvent({ data: { tenantId, venueId, eventType } })
                    .then(() => {
                      feedback.setSuccess('Fichaje guardado.')
                      onDone()
                    })
                    .catch(() => feedback.setError('No se ha podido registrar el fichaje.'))
                }}
                type="button"
              >
                {feedback.pending ? 'Registrando fichaje…' : labels[eventType]}
              </Button>
            ))}
          </div>
          {!isOnline && (
            <output
              aria-live="polite"
              className="text-warning-foreground bg-warning/10 rounded-md p-3 text-sm"
            >
              Sin conexión. El fichaje personal se guardará localmente y se sincronizará al volver
              la red. Pendientes: {pendingOffline}.
            </output>
          )}
          {isOnline && pendingOffline > 0 && (
            <output aria-live="polite" className="text-muted-foreground text-sm">
              Sincronizando {pendingOffline} fichaje{pendingOffline === 1 ? '' : 's'} pendiente
              {pendingOffline === 1 ? '' : 's'}…
            </output>
          )}
          <div className="border-border/70 space-y-3 border-t pt-4">
            <p className="font-medium">PIN de terminal</p>
            <p className="text-muted-foreground text-sm">
              Elige un PIN de 4 a 8 cifras para fichar desde la terminal compartida.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label="Nuevo PIN de terminal"
                autoComplete="new-password"
                inputMode="numeric"
                maxLength={8}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                pattern="[0-9]{4,8}"
                placeholder="Nuevo PIN"
                type="password"
                value={pin}
              />
              <Button
                disabled={feedback.pending || pin.length < 4}
                onClick={() => void savePin()}
                type="button"
              >
                {feedback.pending ? 'Guardando PIN…' : 'Guardar PIN'}
              </Button>
            </div>
          </div>
          <FormFeedback pendingLabel="Guardando…" state={feedback.state} />
        </CardContent>
      </Card>
      {management && (
        <TimekeepingManagement
          feedback={feedback}
          management={management}
          onSaved={onDone}
          tenantId={tenantId}
          venueId={venueId}
        />
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function TimekeepingManagement({
  feedback,
  management,
  onSaved,
  tenantId,
  venueId,
}: {
  feedback: ReturnType<typeof useFormFeedback>
  management: Awaited<ReturnType<typeof getTimekeepingConfiguration>>
  onSaved: () => void
  tenantId: string
  venueId: string
}) {
  const [employeeId, setEmployeeId] = useState(management.employees[0]?.userId ?? '')
  const [assignmentVenueIds, setAssignmentVenueIds] = useState<string[]>(
    () =>
      management.assignments.find((assignment) => assignment.employeeId === employeeId)?.venueIds ??
      [],
  )
  const [report, setReport] = useState<Awaited<
    ReturnType<typeof getTimekeepingAdvancedReport>
  > | null>(null)
  const [reportFrom, setReportFrom] = useState(() => {
    const date = new Date()
    date.setDate(1)
    return date.toISOString().slice(0, 10)
  })
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10))
  const currentTerm = management.terms.find((term) => term.employeeId === employeeId)
  const today = new Date().toISOString().slice(0, 10)
  const [expectedCovers, setExpectedCovers] = useState(86)
  const [currentStaff, setCurrentStaff] = useState(4)
  const staffing = recommendStaffing({
    expectedCovers,
    currentStaff,
    coversPerStaff: 18,
    minimumStaff: 2,
  })

  async function saveTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    feedback.setPending()
    try {
      await saveTimekeepingTerm({
        data: {
          dailyTargetMinutes: Number(formText(values, 'dailyTargetMinutes')),
          effectiveFrom: formText(values, 'effectiveFrom'),
          employeeId,
          employmentType:
            formText(values, 'employmentType') === 'part_time' ? 'part_time' : 'full_time',
          minimumBreakMinutes: Number(formText(values, 'minimumBreakMinutes')),
          minimumDailyRestMinutes: Number(formText(values, 'minimumDailyRestMinutes')),
          nightEndsAt: formText(values, 'nightEndsAt'),
          nightStartsAt: formText(values, 'nightStartsAt'),
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Condiciones laborales guardadas.')
      onSaved()
    } catch {
      feedback.setError('No se han podido guardar las condiciones.')
    }
  }

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    feedback.setPending()
    try {
      await saveTimekeepingRate({
        data: {
          effectiveFrom: formText(values, 'rateEffectiveFrom'),
          employeeId,
          hourlyCostCents: Math.round(Number(formText(values, 'hourlyCostEuros')) * 100),
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Coste horario guardado.')
      onSaved()
    } catch {
      feedback.setError('No se ha podido guardar el coste horario.')
    }
  }

  async function saveHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    feedback.setPending()
    try {
      await saveTimekeepingHoliday({
        data: {
          holidayDate: formText(values, 'holidayDate'),
          label: formText(values, 'label'),
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Festivo guardado.')
      onSaved()
    } catch {
      feedback.setError('No se ha podido guardar el festivo.')
    }
  }

  async function saveAssignments() {
    feedback.setPending()
    try {
      await saveTimekeepingVenueAssignments({
        data: {
          effectiveFrom: today,
          employeeId,
          tenantId,
          venueId,
          venueIds: assignmentVenueIds,
        },
      })
      feedback.setSuccess('Centros del empleado actualizados y guardados en el histórico.')
      onSaved()
    } catch {
      feedback.setError('No se han podido actualizar los centros del empleado.')
    }
  }

  async function saveShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    feedback.setPending()
    try {
      await createWorkforceShift({
        data: {
          employeeId,
          endsAt: new Date(formText(values, 'shiftEndsAt')).toISOString(),
          note: formText(values, 'shiftNote') || undefined,
          startsAt: new Date(formText(values, 'shiftStartsAt')).toISOString(),
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Turno guardado en borrador.')
      onSaved()
    } catch (error) {
      feedback.setError(
        error instanceof Error && error.message.includes('overlap')
          ? 'El empleado ya tiene un turno solapado.'
          : 'No se ha podido guardar el turno.',
      )
    }
  }

  async function changeShiftStatus(shiftId: string, status: 'published' | 'cancelled') {
    feedback.setPending()
    try {
      await updateWorkforceShiftStatus({ data: { shiftId, status, tenantId, venueId } })
      feedback.setSuccess(status === 'published' ? 'Turno publicado.' : 'Turno cancelado.')
      onSaved()
    } catch {
      feedback.setError('No se ha podido actualizar el turno.')
    }
  }

  async function saveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    feedback.setPending()
    try {
      await saveWorkforceAvailability({
        data: {
          available: true,
          employeeId,
          endsAt: formText(values, 'availabilityEndsAt'),
          startsAt: formText(values, 'availabilityStartsAt'),
          tenantId,
          venueId,
          weekday: Number(formText(values, 'availabilityWeekday')),
        },
      })
      feedback.setSuccess('Disponibilidad guardada.')
      onSaved()
    } catch {
      feedback.setError('No se ha podido guardar la disponibilidad.')
    }
  }

  async function saveAbsence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    feedback.setPending()
    try {
      await createWorkforceAbsence({
        data: {
          employeeId,
          endsAt: formText(values, 'absenceEndsAt'),
          reason: formText(values, 'absenceReason'),
          startsAt: formText(values, 'absenceStartsAt'),
          tenantId,
          venueId,
        },
      })
      feedback.setSuccess('Ausencia registrada para aprobación.')
      onSaved()
    } catch {
      feedback.setError('No se ha podido registrar la ausencia.')
    }
  }

  async function loadReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    try {
      const value = await getTimekeepingAdvancedReport({
        data: {
          from: new Date(`${reportFrom}T00:00:00.000Z`).toISOString(),
          tenantId,
          to: new Date(`${reportTo}T23:59:59.999Z`).toISOString(),
          venueId,
        },
      })
      setReport(value)
      feedback.setSuccess('Informe laboral generado.')
    } catch {
      feedback.setError('No se ha podido generar el informe laboral.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración laboral</CardTitle>
        <p className="text-muted-foreground text-sm">
          Ajustes sencillos por empleado y festivos del local. Se guardan como histórico.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {management.employees.length > 0 ? (
          <form
            className="grid gap-4 md:grid-cols-2"
            key={employeeId}
            onSubmit={(event) => void saveTerm(event)}
          >
            <label className="md:col-span-2">
              <span className="mb-1 block text-sm font-medium">Empleado</span>
              <select
                className="border-input h-10 w-full rounded-md border bg-transparent px-3"
                onChange={(event) => {
                  const nextEmployeeId = event.target.value
                  setEmployeeId(nextEmployeeId)
                  setAssignmentVenueIds(
                    management.assignments.find(
                      (assignment) => assignment.employeeId === nextEmployeeId,
                    )?.venueIds ?? [],
                  )
                }}
                value={employeeId}
              >
                {management.employees.map((employee) => (
                  <option key={employee.userId} value={employee.userId}>
                    {employee.displayName}
                  </option>
                ))}
              </select>
            </label>
            <Field>
              <FieldLabel htmlFor="term-type">Tipo de jornada</FieldLabel>
              <select
                className="border-input h-10 w-full rounded-md border bg-transparent px-3"
                defaultValue={currentTerm?.employmentType ?? 'full_time'}
                id="term-type"
                name="employmentType"
              >
                <option value="full_time">Completa</option>
                <option value="part_time">Parcial</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="term-target">Objetivo diario (minutos)</FieldLabel>
              <Input
                defaultValue={currentTerm?.dailyTargetMinutes ?? 480}
                id="term-target"
                max={960}
                min={1}
                name="dailyTargetMinutes"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="term-break">Pausa mínima (minutos)</FieldLabel>
              <Input
                defaultValue={currentTerm?.minimumBreakMinutes ?? 15}
                id="term-break"
                max={180}
                min={0}
                name="minimumBreakMinutes"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="term-rest">Descanso entre jornadas (minutos)</FieldLabel>
              <Input
                defaultValue={currentTerm?.minimumDailyRestMinutes ?? 720}
                id="term-rest"
                max={1440}
                min={0}
                name="minimumDailyRestMinutes"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="term-from">Vigente desde</FieldLabel>
              <Input
                defaultValue={currentTerm?.effectiveFrom ?? today}
                id="term-from"
                name="effectiveFrom"
                type="date"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="term-night-start">Inicio nocturno</FieldLabel>
              <Input
                defaultValue={currentTerm?.nightStartsAt ?? '22:00'}
                id="term-night-start"
                name="nightStartsAt"
                type="time"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="term-night-end">Fin nocturno</FieldLabel>
              <Input
                defaultValue={currentTerm?.nightEndsAt ?? '06:00'}
                id="term-night-end"
                name="nightEndsAt"
                type="time"
              />
            </Field>
            <Button className="md:col-span-2" disabled={feedback.pending} type="submit">
              Guardar condiciones
            </Button>
          </form>
        ) : (
          <p className="text-muted-foreground text-sm">No hay empleados activos configurables.</p>
        )}
        {management.employees.length > 0 && (
          <form
            className="grid gap-4 border-t pt-5 md:grid-cols-3"
            onSubmit={(event) => void saveRate(event)}
          >
            <Field>
              <FieldLabel htmlFor="hourly-cost">Coste horario para el restaurante (€)</FieldLabel>
              <Input
                defaultValue={(
                  (management.rates.find((rate) => rate.employeeId === employeeId)
                    ?.hourlyCostCents ?? 0) / 100
                ).toFixed(2)}
                id="hourly-cost"
                min={0}
                name="hourlyCostEuros"
                step="0.01"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rate-effective-from">Vigente desde</FieldLabel>
              <Input
                defaultValue={
                  management.rates.find((rate) => rate.employeeId === employeeId)?.effectiveFrom ??
                  today
                }
                id="rate-effective-from"
                name="rateEffectiveFrom"
                type="date"
              />
            </Field>
            <div className="flex items-end">
              <Button disabled={feedback.pending} type="submit" variant="outline">
                Guardar coste horario
              </Button>
            </div>
          </form>
        )}
        {management.employees.length > 0 && (
          <div className="space-y-3 border-t pt-5">
            <div>
              <p className="font-medium">Centros del empleado</p>
              <p className="text-muted-foreground text-sm">
                Sin seleccionar ningún local conserva el acceso a todos los locales. Cada cambio se
                conserva con fecha para revisión.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {management.venues.map((venue) => (
                <label className="flex items-center gap-2 text-sm" key={venue.id}>
                  <input
                    checked={assignmentVenueIds.includes(venue.id)}
                    onChange={(event) =>
                      setAssignmentVenueIds((current) =>
                        event.target.checked
                          ? [...current, venue.id]
                          : current.filter((id) => id !== venue.id),
                      )
                    }
                    type="checkbox"
                  />
                  {venue.name}
                </label>
              ))}
            </div>
            <Button
              disabled={feedback.pending}
              onClick={() => void saveAssignments()}
              type="button"
            >
              Guardar centros
            </Button>
          </div>
        )}
        {management.employees.length > 0 && (
          <div className="space-y-4 border-t pt-5">
            <div>
              <p className="font-medium">Próximos turnos</p>
              <p className="text-muted-foreground text-sm">
                Los turnos se guardan inicialmente como borrador para revisión del responsable.
              </p>
            </div>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => void saveShift(event)}>
              <Field>
                <FieldLabel htmlFor="shift-start">Inicio</FieldLabel>
                <Input id="shift-start" name="shiftStartsAt" required type="datetime-local" />
              </Field>
              <Field>
                <FieldLabel htmlFor="shift-end">Fin</FieldLabel>
                <Input id="shift-end" name="shiftEndsAt" required type="datetime-local" />
              </Field>
              <Field>
                <FieldLabel htmlFor="shift-note">Nota</FieldLabel>
                <Input id="shift-note" name="shiftNote" placeholder="Zona o servicio" />
              </Field>
              <Button className="md:col-span-3" disabled={feedback.pending} type="submit">
                Añadir turno
              </Button>
            </form>
            {management.shifts.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {management.shifts.slice(0, 10).map((shift) => (
                  <li
                    className="flex flex-wrap justify-between gap-2 rounded-md border p-3"
                    key={shift.id}
                  >
                    <span>
                      {management.employees.find((employee) => employee.userId === shift.employeeId)
                        ?.displayName ?? 'Empleado'}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(shift.startsAt).toLocaleString('es-ES')} →{' '}
                      {new Date(shift.endsAt).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {shift.status}
                    </span>
                    {shift.status === 'draft' && (
                      <Button
                        disabled={feedback.pending}
                        onClick={() => void changeShiftStatus(shift.id, 'published')}
                        size="sm"
                        type="button"
                      >
                        Publicar
                      </Button>
                    )}
                    {shift.status !== 'cancelled' && (
                      <Button
                        disabled={feedback.pending}
                        onClick={() => void changeShiftStatus(shift.id, 'cancelled')}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Cancelar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No hay turnos próximos.</p>
            )}
          </div>
        )}
        {management.employees.length > 0 && (
          <div className="space-y-4 border-t pt-5">
            <div>
              <p className="font-medium">Disponibilidad y ausencias</p>
              <p className="text-muted-foreground text-sm">
                Configura cuándo puede trabajar la persona seleccionada y registra ausencias para
                bloquear publicaciones.
              </p>
            </div>
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={(event) => void saveAvailability(event)}
            >
              <Field>
                <FieldLabel htmlFor="availability-weekday">Día</FieldLabel>
                <select
                  className="border-input h-10 rounded-md border bg-transparent px-3"
                  id="availability-weekday"
                  name="availabilityWeekday"
                  defaultValue="1"
                >
                  <option value="1">Lunes</option>
                  <option value="2">Martes</option>
                  <option value="3">Miércoles</option>
                  <option value="4">Jueves</option>
                  <option value="5">Viernes</option>
                  <option value="6">Sábado</option>
                  <option value="0">Domingo</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="availability-start">Desde</FieldLabel>
                <Input
                  id="availability-start"
                  name="availabilityStartsAt"
                  required
                  type="time"
                  defaultValue="09:00"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="availability-end">Hasta</FieldLabel>
                <Input
                  id="availability-end"
                  name="availabilityEndsAt"
                  required
                  type="time"
                  defaultValue="18:00"
                />
              </Field>
              <div className="flex items-end">
                <Button disabled={feedback.pending} type="submit">
                  Guardar disponibilidad
                </Button>
              </div>
            </form>
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={(event) => void saveAbsence(event)}
            >
              <Input aria-label="Inicio de ausencia" name="absenceStartsAt" required type="date" />
              <Input aria-label="Fin de ausencia" name="absenceEndsAt" required type="date" />
              <Input
                aria-label="Motivo de ausencia"
                name="absenceReason"
                placeholder="Vacaciones, baja…"
                required
              />
              <Button disabled={feedback.pending} type="submit" variant="outline">
                Registrar ausencia
              </Button>
            </form>
          </div>
        )}
        <div className="space-y-4 border-t pt-5">
          <div>
            <p className="font-medium">Recomendación de plantilla</p>
            <p className="text-muted-foreground text-sm">
              Ajusta la previsión del servicio para detectar exceso o falta de personal.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="staffing-covers">Cubiertos previstos</FieldLabel>
              <Input
                id="staffing-covers"
                min={0}
                onChange={(event) => setExpectedCovers(Number(event.target.value))}
                type="number"
                value={expectedCovers}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="staffing-current">Personas previstas</FieldLabel>
              <Input
                id="staffing-current"
                min={0}
                onChange={(event) => setCurrentStaff(Number(event.target.value))}
                type="number"
                value={currentStaff}
              />
            </Field>
          </div>
          <p className="bg-muted/20 rounded-md border p-3 text-sm">
            {staffing.reason}{' '}
            {staffing.delta > 0
              ? `Faltan ${staffing.delta}.`
              : staffing.delta < 0
                ? `Sobran ${Math.abs(staffing.delta)}.`
                : ''}
          </p>
        </div>
        <form
          className="grid gap-4 border-t pt-5 md:grid-cols-[auto_1fr_auto]"
          onSubmit={(event) => void saveHoliday(event)}
        >
          <Input aria-label="Fecha del festivo" name="holidayDate" required type="date" />
          <Input
            aria-label="Nombre del festivo"
            name="label"
            placeholder="Nombre del festivo"
            required
          />
          <Button disabled={feedback.pending} type="submit" variant="outline">
            Añadir festivo
          </Button>
        </form>
        {management.holidays.length > 0 && (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {management.holidays.slice(-5).map((holiday) => (
              <li key={holiday.date}>
                {holiday.date} · {holiday.label}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-4 border-t pt-5">
          <div>
            <p className="font-medium">Informe laboral avanzado</p>
            <p className="text-muted-foreground text-sm">
              Resumen por empleado y local con minutos, nocturnidad, festivos, excesos e
              incidencias. Es orientativo y debe revisarlo la asesoría.
            </p>
          </div>
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={(event) => void loadReport(event)}>
            <Input
              aria-label="Desde el informe laboral"
              onChange={(event) => setReportFrom(event.target.value)}
              required
              type="date"
              value={reportFrom}
            />
            <Input
              aria-label="Hasta el informe laboral"
              onChange={(event) => setReportTo(event.target.value)}
              required
              type="date"
              value={reportTo}
            />
            <Button disabled={feedback.pending} type="submit" variant="outline">
              Generar informe
            </Button>
          </form>
          {report && (
            <section aria-label="Resultado del informe laboral" className="space-y-2">
              <p className="text-sm font-medium">
                Total: {report.totalWorkedMinutes} min trabajados
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">Empleado</th>
                      <th className="p-2">Trabajado</th>
                      <th className="p-2">Noche/festivo</th>
                      <th className="p-2">Exceso</th>
                      <th className="p-2">Incidencias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr className="border-b" key={row.employeeId}>
                        <td className="p-2">{row.displayName}</td>
                        <td className="p-2">{row.workedMinutes} min</td>
                        <td className="p-2">
                          {row.nightMinutes}/{row.holidayMinutes} min
                        </td>
                        <td className="p-2">
                          {row.overtimeMinutes + row.complementaryMinutes} min
                        </td>
                        <td className="p-2">
                          {row.breakViolationCount + row.restViolationCount} · {row.splitShiftDays}{' '}
                          partidas
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
        <FormFeedback pendingLabel="Guardando configuración…" state={feedback.state} />
      </CardContent>
    </Card>
  )
}
