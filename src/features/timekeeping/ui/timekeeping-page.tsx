import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, PageHeaderDescription, PageHeaderTitle, useFormFeedback, FormFeedback } from '@doscientos/ui'
import { recordTimeEvent } from '../application/timekeeping'
import { allowedNextEvent, type TimeEventType } from '../domain/timekeeping'

const labels: Record<TimeEventType, string> = { clock_in: 'Entrar', break_start: 'Iniciar pausa', break_end: 'Terminar pausa', clock_out: 'Salir' }
export function TimekeepingPage({ summary, tenantId, venueId, onDone }: { summary: Awaited<ReturnType<typeof import('../application/timekeeping').getMyTimekeeping>>; tenantId: string; venueId: string; onDone: () => void }) {
  const feedback = useFormFeedback(); const last = summary.events.at(-1)?.eventType ?? null; const next = allowedNextEvent(last)
  return <section className="space-y-6"><PageHeader><div><PageHeaderTitle>Fichaje</PageHeaderTitle><PageHeaderDescription>Registra tu jornada desde este terminal.</PageHeaderDescription></div></PageHeader><Card className="max-w-xl"><CardHeader><CardTitle>{last ? `Último estado: ${labels[last]}` : 'Sin jornada iniciada'}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-2xl font-semibold">{summary.workedMinutes} min trabajados</p><div className="flex flex-wrap gap-3">{next.map((eventType) => <Button key={eventType} disabled={feedback.pending} onClick={() => { feedback.setPending(); void recordTimeEvent({ data: { tenantId, venueId, eventType } }).then(() => { feedback.setSuccess('Fichaje guardado.'); onDone() }).catch(() => feedback.setError('No se ha podido registrar el fichaje.')) }} type="button">{labels[eventType]}</Button>)}</div><FormFeedback pendingLabel="Guardando…" state={feedback.state} /></CardContent></Card></section>
}
