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
  lines,
  locale,
  onDone,
  sessionId,
  tenantId,
  venueId,
}: {
  canEdit: boolean
  canRemove: boolean
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
    const reason = window.prompt('Motivo de la anulación')?.trim()
    if (!reason) return
    feedback.setPending()
    try {
      await removeOrderItem({ data: { orderItemId, reason, sessionId, tenantId, venueId } })
      onDone()
    } catch {
      feedback.setError('No se ha podido anular. Si ya hay cobros, la cuenta queda fija.')
    }
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
                    <span className="flex justify-end gap-2">
                      {canEdit &&
                        line.status !== 'cancelled' &&
                        line.status !== 'served' &&
                        (editingId === line.id ? (
                          <span className="flex items-center gap-2">
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
                              value={editNotes}
                            />
                            <Button
                              disabled={feedback.pending}
                              onClick={() => void saveEdit(line.id)}
                              size="sm"
                              type="button"
                            >
                              Guardar
                            </Button>
                            <Button
                              onClick={() => setEditingId(null)}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Cancelar
                            </Button>
                          </span>
                        ) : (
                          <Button
                            onClick={() => beginEdit(line)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Editar
                          </Button>
                        ))}
                      {canRemove && line.status !== 'cancelled' && (
                        <Button
                          disabled={feedback.pending}
                          onClick={() => void remove(line.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Anular
                        </Button>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <FormFeedback pendingLabel="Quitando línea…" state={feedback.state} />
      </CardContent>
    </Card>
  )
}
