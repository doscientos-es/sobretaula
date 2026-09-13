import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  useFormFeedback,
  FormFeedback,
} from '@doscientos/ui'
import { CheckCircle2, CircleDollarSign, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import {
  closeTipsPeriod,
  deleteTipEntry,
  saveTipEntry,
  updateTipEntry,
  type getTipsOverview,
} from '../application/tips'
import { describeTipAuditEvent } from '../domain/tips'
type Overview = Awaited<ReturnType<typeof getTipsOverview>>
const euro = (c: number) => `${(c / 100).toFixed(2).replace('.', ',')} €`
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
const formValue = (form: FormData, name: string) => {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
const quickPeriod = (kind: 'month' | 'week' | 'last') => {
  const today = new Date()
  const to = new Date(today)
  to.setDate(to.getDate() - 1)
  const from = new Date(to)
  if (kind === 'month') {
    from.setMonth(from.getMonth() - 1)
    from.setDate(from.getDate() + 1)
  }
  if (kind === 'week') from.setDate(from.getDate() - 6)
  return { from: kind === 'last' ? '' : isoDate(from), to: kind === 'last' ? '' : isoDate(to) }
}
export function TipsPage({
  overview,
  tenantId,
  venueId,
  onDone,
  onPageChange,
}: {
  overview: Overview
  tenantId: string
  venueId: string
  onDone: () => void
  onPageChange: (page: number) => void
}) {
  const feedback = useFormFeedback()
  const [result, setResult] = useState<Awaited<ReturnType<typeof closeTipsPeriod>> | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const editingEntry = overview.entries.find((entry) => entry.id === editingEntryId) ?? null
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote] = useState('')
  const [selectedTipDate, setSelectedTipDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const registeredTipDates = new Set(overview.registeredTipDates)
  const selectedDateAlreadyRegistered = registeredTipDates.has(selectedTipDate)
  const lastClosedTo = overview.periods[0]?.to_date ?? null
  function setPeriod(from: string, to: string) {
    const form = document.querySelector<HTMLFormElement>('#close-tips-form')
    if (!form) return
    ;(form.elements.namedItem('from') as HTMLInputElement).value = from
    ;(form.elements.namedItem('to') as HTMLInputElement).value = to
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fd = new FormData(event.currentTarget)
    feedback.setPending()
    try {
      await saveTipEntry({
        data: {
          tenantId,
          venueId,
          date: formValue(fd, 'date'),
          amountCents: Math.round(Number(formValue(fd, 'amount')) * 100),
          note: formValue(fd, 'note'),
        },
      })
      feedback.setSuccess('Cierre diario guardado.')
      onDone()
    } catch (error) {
      feedback.setError(
        error instanceof Error && error.message.includes('23505')
          ? 'Ese día ya tiene un cierre registrado. Elige otro día.'
          : 'No se ha podido guardar el cierre.',
      )
    }
  }
  async function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fd = new FormData(event.currentTarget)
    feedback.setPending()
    try {
      setResult(
        await closeTipsPeriod({
          data: { tenantId, venueId, from: formValue(fd, 'from'), to: formValue(fd, 'to') },
        }),
      )
      feedback.setSuccess('Periodo cerrado y reparto calculado.')
    } catch {
      feedback.setError('No se ha podido cerrar el periodo.')
    }
  }
  function openEdit(entry: Overview['entries'][number]) {
    setEditAmount((Number(entry.amount_cents) / 100).toFixed(2))
    setEditNote(entry.note ?? '')
    setEditingEntryId(entry.id)
  }
  async function editEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingEntry) return
    try {
      await updateTipEntry({
        data: {
          tenantId,
          venueId,
          entryId: editingEntry.id,
          amountCents: Math.round(Number(editAmount.replace(',', '.')) * 100),
          note: editNote,
        },
      })
      feedback.setSuccess('Cierre actualizado y registrado en el historial.')
      setEditingEntryId(null)
      onDone()
    } catch {
      feedback.setError('No se ha podido actualizar el cierre.')
    } finally {
      setEditingEntryId(null)
    }
  }
  async function removeEntry(entry: Overview['entries'][number]) {
    if (
      !window.confirm(
        `¿Eliminar el cierre del ${entry.tip_date}? Se conservará el trazo en el historial.`,
      )
    )
      return
    setEditingEntryId(entry.id)
    try {
      await deleteTipEntry({ data: { tenantId, venueId, entryId: entry.id } })
      feedback.setSuccess('Cierre eliminado y registrado en el historial.')
      onDone()
    } catch {
      feedback.setError('No se ha podido eliminar el cierre.')
    } finally {
      setEditingEntryId(null)
    }
  }
  return (
    <section className="space-y-6">
      <PageHeader>
        <div>
          <PageHeaderTitle>Bote de propinas</PageHeaderTitle>
          <PageHeaderDescription>
            Apunta sólo el total al cerrar el día. El reparto se calcula por horas fichadas.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Saldo acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{euro(overview.balanceCents)}</p>
            <p className="text-muted-foreground text-sm">Pendiente de cerrar</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Cierre diario</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => void save(e)}>
              <Field>
                <FieldLabel htmlFor="tip-date">Día</FieldLabel>
                <Input
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  id="tip-date"
                  onChange={(event) => setSelectedTipDate(event.target.value)}
                  aria-describedby="tip-date-help"
                  name="date"
                  required
                  type="date"
                />
                <p className="text-muted-foreground text-xs" id="tip-date-help">
                  {selectedDateAlreadyRegistered
                    ? 'Este día ya tiene un cierre. Selecciona otro.'
                    : 'Los días con cierre ya registrado no se pueden volver a añadir.'}
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="tip-amount">Total del bote (€)</FieldLabel>
                <Input id="tip-amount" min="0" name="amount" required step="0.01" type="number" />
              </Field>
              <Button
                className="self-end"
                disabled={feedback.pending || selectedDateAlreadyRegistered}
                type="submit"
              >
                Guardar día
              </Button>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="tip-note">Nota (opcional)</FieldLabel>
                <Input
                  id="tip-note"
                  maxLength={500}
                  name="note"
                  placeholder="Turno, incidencia o explicación del ajuste…"
                />
              </Field>
            </form>
          </CardContent>
        </Card>
      </div>
      <DialogRoot
        onOpenChange={(open) => !open && setEditingEntryId(null)}
        open={editingEntry !== null}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cierre diario</DialogTitle>
            <DialogDescription>
              Corrige el importe o la nota del {editingEntry?.tip_date}. El cambio quedará
              registrado en el historial.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={(event) => void editEntry(event)}>
            <Field>
              <FieldLabel htmlFor="edit-tip-amount">Total del bote (€)</FieldLabel>
              <Input
                id="edit-tip-amount"
                min="0"
                onChange={(event) => setEditAmount(event.target.value)}
                required
                step="0.01"
                type="number"
                value={editAmount}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-tip-note">Nota (opcional)</FieldLabel>
              <Input
                id="edit-tip-note"
                maxLength={500}
                onChange={(event) => setEditNote(event.target.value)}
                value={editNote}
              />
            </Field>
            <DialogFooter>
              <Button onClick={() => setEditingEntryId(null)} type="button" variant="outline">
                Cancelar
              </Button>
              <Button disabled={feedback.pending} type="submit">
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
      <Card>
        <CardHeader>
          <CardTitle>Cerrar periodo y repartir</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const p = quickPeriod('month')
                setPeriod(p.from, p.to)
              }}
            >
              Último mes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const p = quickPeriod('week')
                setPeriod(p.from, p.to)
              }}
            >
              Última semana
            </Button>
            {lastClosedTo ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPeriod(
                    isoDate(addDays(new Date(`${lastClosedTo}T00:00:00`), 1)),
                    isoDate(addDays(new Date(), -1)),
                  )
                }}
              >
                Desde la última vez · {lastClosedTo}
              </Button>
            ) : null}
          </div>
          <form
            id="close-tips-form"
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => void close(e)}
          >
            <Field>
              <FieldLabel htmlFor="tips-from">Desde</FieldLabel>
              <Input id="tips-from" aria-label="Desde" name="from" required type="date" />
            </Field>
            <Field>
              <FieldLabel htmlFor="tips-to">Hasta</FieldLabel>
              <Input id="tips-to" aria-label="Hasta" name="to" required type="date" />
            </Field>
            <Button disabled={feedback.pending} type="submit">
              Calcular y cerrar
            </Button>
          </form>
          {result && (
            <div className="mt-5 overflow-x-auto">
              <p className="mb-2 font-medium">Total repartido: {euro(result.totalCents)}</p>
              {result.skippedPaidDates.length ? (
                <p className="text-muted-foreground mb-3 text-sm">
                  Se han omitido propinas ya repartidas: {result.skippedPaidDates.join(', ')}.
                </p>
              ) : null}
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">Persona</th>
                    <th className="p-2">Horas/minutos</th>
                    <th className="p-2">Le corresponde</th>
                  </tr>
                </thead>
                <tbody>
                  {result.distribution.map((row) => (
                    <tr className="border-b" key={row.employeeId}>
                      <td className="p-2">{row.displayName}</td>
                      <td className="p-2">{row.minutes} min</td>
                      <td className="p-2 font-medium">{euro(row.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cierres diarios vigentes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {overview.entries.slice(0, 10).map((entry) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 border-b pb-2"
                key={entry.id}
              >
                <span>
                  <span className="block">{entry.tip_date}</span>
                  <span className="text-muted-foreground text-xs">
                    Registrado por {entry.recordedBy} · {dateTime(entry.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-2 font-medium">
                  {entry.paid_at ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-normal text-emerald-700"
                      title="Propina ya cobrada"
                    >
                      <CheckCircle2 aria-hidden="true" className="size-3.5" /> Cobrada
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-normal text-amber-700"
                      title="Propina pendiente de cobro"
                    >
                      <CircleDollarSign aria-hidden="true" className="size-3.5" /> Pendiente
                    </span>
                  )}
                  {euro(Number(entry.amount_cents))}
                  {!entry.paid_at ? (
                    <>
                      <Button
                        aria-label={`Editar cierre del ${entry.tip_date}`}
                        disabled={editingEntryId === entry.id}
                        onClick={() => openEdit(entry)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Eliminar cierre del ${entry.tip_date}`}
                        disabled={editingEntryId === entry.id}
                        onClick={() => void removeEntry(entry)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="text-destructive size-4" />
                      </Button>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span>
              Página {overview.entriesPage} · {overview.entriesTotal} cierres
            </span>
            <div className="flex gap-2">
              <Button
                disabled={overview.entriesPage <= 1}
                onClick={() => onPageChange(overview.entriesPage - 1)}
                type="button"
                variant="outline"
              >
                Anterior
              </Button>
              <Button
                disabled={!overview.entriesHasMore}
                onClick={() => onPageChange(overview.entriesPage + 1)}
                type="button"
                variant="outline"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Historial de propinas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Cada registro conserva quién lo realizó, cuándo y el importe anotado. Este historial no
            se puede editar ni eliminar.
          </p>
          {overview.auditEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aún no se ha registrado actividad.</p>
          ) : (
            <ul className="space-y-3">
              {overview.auditEvents.map((event) => {
                const action = describeTipAuditEvent({
                  eventType: event.event_type,
                  fromDate: event.from_date,
                  tipDate: event.tip_date,
                  toDate: event.to_date,
                })
                return (
                  <li className="border-border/70 border-b pb-3 text-sm" key={event.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="font-medium">{action}</span>
                      <span className="font-medium">{euro(Number(event.total_cents))}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {event.actor_display_name} · {dateTime(event.occurred_at)}
                    </p>
                    {event.note ? <p className="mt-1 text-sm">Nota: {event.note}</p> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <FormFeedback pendingLabel="Guardando…" state={feedback.state} />
    </section>
  )
}
