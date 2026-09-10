import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  useFormFeedback,
  FormFeedback,
  Input,
} from '@doscientos/ui'
import { useState } from 'react'

import {
  recordTimeEvent,
  setMyTimekeepingPin,
  type getMyTimekeeping,
} from '../application/timekeeping'
import { allowedNextEvent, type TimeEventType } from '../domain/timekeeping'

const labels: Record<TimeEventType, string> = {
  clock_in: 'Entrar',
  break_start: 'Iniciar pausa',
  break_end: 'Terminar pausa',
  clock_out: 'Salir',
}
export function TimekeepingPage({
  summary,
  tenantId,
  venueId,
  onDone,
}: {
  summary: Awaited<ReturnType<typeof getMyTimekeeping>>
  tenantId: string
  venueId: string
  onDone: () => void
}) {
  const feedback = useFormFeedback()
  const [pin, setPin] = useState('')
  const last = summary.events.at(-1)?.eventType ?? null
  const next = allowedNextEvent(last)

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
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{last ? `Último estado: ${labels[last]}` : 'Sin jornada iniciada'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-semibold">{summary.workedMinutes} min trabajados</p>
          <div className="flex flex-wrap gap-3">
            {next.map((eventType) => (
              <Button
                key={eventType}
                disabled={feedback.pending}
                onClick={() => {
                  feedback.setPending()
                  void recordTimeEvent({ data: { tenantId, venueId, eventType } })
                    .then(() => {
                      feedback.setSuccess('Fichaje guardado.')
                      onDone()
                    })
                    .catch(() => feedback.setError('No se ha podido registrar el fichaje.'))
                }}
                type="button"
              >
                {labels[eventType]}
              </Button>
            ))}
          </div>
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
                Guardar PIN
              </Button>
            </div>
          </div>
          <FormFeedback pendingLabel="Guardando…" state={feedback.state} />
        </CardContent>
      </Card>
    </section>
  )
}
