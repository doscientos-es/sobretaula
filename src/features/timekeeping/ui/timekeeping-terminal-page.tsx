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
import { useState } from 'react'

import { recordTerminalTimeEvent } from '../application/timekeeping'
import type { TimeEventType } from '../domain/timekeeping'

const actions: { label: string; value: TimeEventType }[] = [
  { label: 'Entrar', value: 'clock_in' },
  { label: 'Iniciar pausa', value: 'break_start' },
  { label: 'Terminar pausa', value: 'break_end' },
  { label: 'Salir', value: 'clock_out' },
]

function terminalStorageKey(tenantId: string, venueId: string): string {
  return `sobretaula:timekeeping-terminal:${tenantId}:${venueId}`
}

function getTerminalId(tenantId: string, venueId: string): string {
  const key = terminalStorageKey(tenantId, venueId)
  const fallback = `web-${crypto.randomUUID()}`
  try {
    const saved = window.localStorage.getItem(key)
    if (saved) return saved
    window.localStorage.setItem(key, fallback)
  } catch {
    // El límite adicional por empleado se mantiene aunque el navegador bloquee storage.
  }
  return fallback
}

function terminalError(error: unknown): string {
  if (error instanceof Response) {
    if (error.status === 401) return 'El PIN no es válido.'
    if (error.status === 409) return 'Esta acción no corresponde al estado actual de la jornada.'
    if (error.status === 429) return 'El terminal está bloqueado durante 15 minutos por seguridad.'
  }
  return 'No se ha podido registrar el fichaje. Comprueba la conexión e inténtalo de nuevo.'
}

/** Shared, authenticated venue terminal. The employee PIN is never retained in browser storage. */
export function TimekeepingTerminalPage({
  staff,
  tenantId,
  venueId,
}: {
  staff: readonly { displayName: string; role: string; userId: string }[]
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()
  const [employeeId, setEmployeeId] = useState(staff[0]?.userId ?? '')
  const [pin, setPin] = useState('')

  async function clock(eventType: TimeEventType) {
    if (!employeeId || !pin) {
      feedback.setError('Selecciona tu nombre e introduce tu PIN para fichar.')
      return
    }
    feedback.setPending()
    try {
      const terminalId = getTerminalId(tenantId, venueId)
      await recordTerminalTimeEvent({
        data: { employeeId, eventType, pin, tenantId, terminalId, venueId },
      })
      setPin('')
      feedback.setSuccess('Fichaje registrado correctamente.')
    } catch (error) {
      feedback.setError(terminalError(error))
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader>
        <div>
          <PageHeaderTitle>Fichaje de equipo</PageHeaderTitle>
          <PageHeaderDescription>
            Selecciona tu nombre, introduce tu PIN y registra el momento de tu jornada.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Terminal compartido</CardTitle>
          <CardDescription>
            El PIN se comprueba en servidor, no se guarda en este dispositivo y cinco intentos
            fallidos bloquean temporalmente el terminal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="terminal-employee">Empleado</FieldLabel>
            <select
              className="border-input min-h-10 w-full rounded-md border bg-transparent px-3"
              id="terminal-employee"
              onChange={(event) => setEmployeeId(event.target.value)}
              value={employeeId}
            >
              {staff.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName} · {member.role}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="terminal-pin">PIN personal</FieldLabel>
            <Input
              autoComplete="off"
              id="terminal-pin"
              inputMode="numeric"
              maxLength={8}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              pattern="[0-9]{4,8}"
              type="password"
              value={pin}
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            {actions.map((action) => (
              <Button
                disabled={feedback.pending || staff.length === 0}
                key={action.value}
                onClick={() => void clock(action.value)}
                type="button"
                variant={action.value === 'clock_out' ? 'outline' : 'default'}
              >
                {action.label}
              </Button>
            ))}
          </div>
          {staff.length === 0 && (
            <p className="text-muted-foreground text-sm">No hay empleados activos.</p>
          )}
          <FormFeedback pendingLabel="Registrando fichaje…" state={feedback.state} />
        </CardContent>
      </Card>
    </section>
  )
}
