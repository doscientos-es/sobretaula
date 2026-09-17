import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormFeedback,
  Input,
  QuantityInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useFormFeedback,
} from '@doscientos/ui'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { formatMoney } from '@/shared/lib/money/money'

import { removeOrderItem, updateOrderItem } from '../application/account'
import { lineGrossCents, type AccountLine, type KitchenStation } from '../domain/account'

const STATION_LABEL: Record<KitchenStation, string> = {
  bar: 'Barra',
  cold: 'Frío',
  dessert: 'Postres',
  general: 'General',
  hot: 'Caliente',
}

/** Lines already charged to the table, with removal while nothing is paid. */
export function AccountLines({
  canEdit,
  canRemove,
  compact = false,
  lines,
  locale,
  onDone,
  sessionId,
  tenantId,
  venueId,
}: {
  canEdit: boolean
  canRemove: boolean
  compact?: boolean
  lines: readonly AccountLine[]
  locale: Locale
  onDone: () => void
  sessionId: string
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState(1)
  const [editNotes, setEditNotes] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removalReason, setRemovalReason] = useState('')

  function beginEdit(line: AccountLine) {
    setEditingId(line.id)
    setEditQuantity(line.quantity)
    setEditNotes(line.notes ?? '')
  }

  async function saveEdit(orderItemId: string) {
    if (feedback.pending) return
    feedback.setPending()
    try {
      await updateOrderItem({
        data: {
          notes: editNotes.trim() || null,
          orderItemId,
          quantity: editQuantity,
          sessionId,
          tenantId,
          venueId,
        },
      })
      setEditingId(null)
      onDone()
    } catch {
      feedback.setError('No se ha podido editar la línea.')
    }
  }

  async function remove(orderItemId: string) {
    if (feedback.pending) return
    const reason = removalReason.trim()
    if (!reason) return
    feedback.setPending()
    try {
      await removeOrderItem({ data: { orderItemId, reason, sessionId, tenantId, venueId } })
      setRemovingId(null)
      setRemovalReason('')
      onDone()
    } catch {
      feedback.setError('No se ha podido anular. Si ya hay cobros, la cuenta queda fija.')
    }
  }

  function renderActions(line: AccountLine) {
    if (editingId === line.id) {
      return (
        <span className="flex items-center justify-end gap-1">
          <QuantityInput
            aria-label="Cantidad editada"
            minValue={1}
            onChange={setEditQuantity}
            value={editQuantity}
          />
          <Input
            aria-label="Nota editada"
            className="h-8 w-32"
            onChange={(event) => setEditNotes(event.target.value)}
            placeholder="Nota"
            value={editNotes}
          />
          <Button
            aria-label={`Guardar cambios de ${line.name}`}
            disabled={feedback.pending}
            onClick={() => void saveEdit(line.id)}
            size="icon"
            type="button"
          >
            <Check aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label="Cancelar edición"
            onClick={() => setEditingId(null)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </span>
      )
    }

    if (removingId === line.id) {
      return (
        <span className="flex items-center justify-end gap-1">
          <Input
            aria-label={`Motivo para anular ${line.name}`}
            className="h-8 w-40"
            onChange={(event) => setRemovalReason(event.target.value)}
            placeholder="Motivo obligatorio"
            value={removalReason}
          />
          <Button
            aria-label={`Confirmar anulación de ${line.name}`}
            disabled={feedback.pending || !removalReason.trim()}
            onClick={() => void remove(line.id)}
            size="icon"
            type="button"
          >
            <Check aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label="Cancelar anulación"
            onClick={() => {
              setRemovingId(null)
              setRemovalReason('')
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </span>
      )
    }

    return (
      <span className="flex justify-end gap-1">
        {canEdit && line.status !== 'cancelled' && line.status !== 'served' && (
          <Button
            aria-label={`Editar ${line.name}`}
            onClick={() => beginEdit(line)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </Button>
        )}
        {canRemove && line.status !== 'cancelled' && (
          <Button
            aria-label={`Anular ${line.name}`}
            disabled={feedback.pending}
            onClick={() => {
              setRemovingId(line.id)
              setRemovalReason('')
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" className="text-destructive size-4" />
          </Button>
        )}
      </span>
    )
  }

  if (compact) {
    return (
      <Card className="rounded-none border-0 bg-transparent shadow-none xl:flex xl:h-full xl:min-h-0 xl:flex-col">
        <CardHeader className="border-border/70 border-b px-0 py-0 pb-3">
          <CardTitle className="text-base">Consumiciones</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          {lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavía no se ha apuntado nada.</p>
          ) : (
            <ul className="divide-border/70 divide-y">
              {lines.map((line) => (
                <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" key={line.id}>
                  <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums">
                    {line.quantity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="leading-tight font-medium">{line.name}</p>
                        {line.status === 'cancelled' && (
                          <span className="text-destructive text-xs font-medium">Anulada</span>
                        )}
                        <span className="text-muted-foreground block text-xs">
                          {STATION_LABEL[line.kitchenStation ?? 'general']}
                        </span>
                        {line.notes && (
                          <span className="text-muted-foreground block text-xs">{line.notes}</span>
                        )}
                        {line.modifiers?.map((modifier) => (
                          <span className="text-muted-foreground block text-xs" key={modifier.id}>
                            {`+ ${modifier.name}`}
                          </span>
                        ))}
                      </div>
                      <span className="shrink-0 text-right font-medium tabular-nums">
                        {line.status === 'cancelled'
                          ? '—'
                          : formatMoney(lineGrossCents(line), locale)}
                      </span>
                    </div>
                    {(canEdit || canRemove) && line.status !== 'cancelled' && (
                      <div className="mt-2">{renderActions(line)}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <FormFeedback pendingLabel="Guardando cambios…" state={feedback.state} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumiciones</CardTitle>
        <CardDescription>Precios congelados en el momento de apuntar cada línea.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no se ha apuntado nada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ud.</TableHead>
                <TableHead>Plato</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.quantity}</TableCell>
                  <TableCell>
                    <span className="whitespace-normal">{line.name}</span>
                    {line.status === 'cancelled' && (
                      <span className="text-destructive ml-2 text-xs font-medium">Anulada</span>
                    )}
                    <span className="text-muted-foreground ml-2 text-xs">
                      · {STATION_LABEL[line.kitchenStation ?? 'general']}
                    </span>
                    {line.notes && (
                      <span className="text-muted-foreground block text-xs whitespace-normal">
                        {line.notes}
                      </span>
                    )}
                    {line.modifiers?.map((modifier) => (
                      <span className="text-muted-foreground block text-xs" key={modifier.id}>
                        {`+ ${modifier.name}`}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell>
                    <span className="block text-right tabular-nums">
                      {formatMoney(line.unitPriceCents, locale)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-right tabular-nums">
                      {line.status === 'cancelled'
                        ? '—'
                        : formatMoney(lineGrossCents(line), locale)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-2">{renderActions(line)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <FormFeedback pendingLabel="Guardando cambios…" state={feedback.state} />
      </CardContent>
    </Card>
  )
}
