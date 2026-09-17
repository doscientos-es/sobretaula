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
import { Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { formatMoney } from '@/shared/lib/money/money'

import { reactivateOrderItem, removeOrderItem, updateOrderItem } from '../application/account'
import {
  createRemoveOrderItemOperation,
  createReactivateOrderItemOperation,
  createUpdateOrderItemOperation,
  createAccountOfflineStore,
  enqueueAccountOperation,
} from '../application/account-offline-operations'
import {
  groupAccountLines,
  isOptimisticAccountLine,
  lineGrossCents,
  type AccountLine,
  type AccountLineGroup,
  type KitchenStation,
} from '../domain/account'

/** El TPV no pide motivo: quitar un plato debe ser un solo click. */
const QUICK_REMOVAL_REASON = 'Quitado en el TPV'

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
  onOptimisticActivate,
  onOptimisticRemove,
  onOptimisticQuantityChange,
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
  onOptimisticActivate?: (lineId: string) => () => void
  onOptimisticRemove?: (lineIds: readonly string[]) => () => void
  onOptimisticQuantityChange?: (lineIds: readonly string[], quantity: number) => () => void
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
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const offlineStore = useMemo(
    () => createAccountOfflineStore(tenantId, venueId),
    [tenantId, venueId],
  )

  useEffect(() => {
    const online = () => setIsOnline(true)
    const offline = () => setIsOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

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
      feedback.setSuccess('Cambios guardados')
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
      feedback.setSuccess('Línea anulada')
    } catch {
      feedback.setError('No se ha podido anular. Si ya hay cobros, la cuenta queda fija.')
    }
  }

  /** Raises or lowers the counter of a group reusing its already saved lines. */
  async function changeGroupQuantity(group: AccountLineGroup, nextQuantity: number) {
    if (feedback.pending) return
    const saved = group.lines.filter((line) => !isOptimisticAccountLine(line))
    const target = saved.at(-1)
    let delta = nextQuantity - group.quantity
    if (delta === 0 || !target) return
    if (!isOnline && !onOptimisticQuantityChange) {
      feedback.setError('Sin conexión: esta cuenta no puede editarse todavía.')
      return
    }
    const rollback = onOptimisticQuantityChange?.(
      saved.map((line) => line.id),
      nextQuantity,
    )
    feedback.setPending()
    try {
      const update = async (line: AccountLine, quantity: number) => {
        const data = {
          notes: line.notes,
          orderItemId: line.id,
          quantity,
          sessionId,
          tenantId,
          venueId,
        }
        if (isOnline) {
          await updateOrderItem({ data })
        } else {
          enqueueAccountOperation(
            offlineStore,
            createUpdateOrderItemOperation(crypto.randomUUID(), data),
          )
        }
      }
      if (delta > 0) {
        await update(target, target.quantity + delta)
      } else {
        for (const line of [...saved].reverse()) {
          if (delta === 0) break
          if (line.quantity + delta > 0) {
            await update(line, line.quantity + delta)
            delta = 0
            break
          }
          const data = {
            orderItemId: line.id,
            reason: 'Ajuste de cantidad',
            sessionId,
            tenantId,
            venueId,
          }
          if (isOnline) {
            await removeOrderItem({ data })
          } else {
            enqueueAccountOperation(
              offlineStore,
              createRemoveOrderItemOperation(crypto.randomUUID(), data),
            )
          }
          delta += line.quantity
        }
      }
      if (isOnline) onDone()
      feedback.setSuccess(isOnline ? 'Cantidad actualizada' : 'Cantidad guardada sin conexión')
    } catch {
      rollback?.()
      feedback.setError('No se ha podido cambiar la cantidad.')
    }
  }

  /** Quita de golpe todas las líneas guardadas que comparten el contador. */
  async function removeGroup(group: AccountLineGroup) {
    if (feedback.pending) return
    const saved = group.lines.filter((line) => !isOptimisticAccountLine(line))
    if (saved.length === 0) return
    if (!isOnline && !onOptimisticRemove) {
      feedback.setError('Sin conexión: esta cuenta no puede modificarse todavía.')
      return
    }
    const rollback = onOptimisticRemove?.(saved.map((line) => line.id))
    feedback.setPending()
    try {
      for (const line of saved) {
        const data = {
          orderItemId: line.id,
          reason: QUICK_REMOVAL_REASON,
          sessionId,
          tenantId,
          venueId,
        }
        if (isOnline) {
          await removeOrderItem({ data })
        } else {
          enqueueAccountOperation(
            offlineStore,
            createRemoveOrderItemOperation(crypto.randomUUID(), data),
          )
        }
      }
      if (isOnline) onDone()
      feedback.setSuccess(isOnline ? 'Quitado' : 'Quitado sin conexión')
    } catch {
      rollback?.()
      feedback.setError('No se ha podido quitar. Si ya hay cobros, la cuenta queda fija.')
    }
  }

  async function activate(line: AccountLine) {
    if (feedback.pending || isOptimisticAccountLine(line)) return
    if (!isOnline && !onOptimisticActivate) {
      feedback.setError('Sin conexión: esta cuenta no puede modificarse todavía.')
      return
    }
    const rollback = onOptimisticActivate?.(line.id)
    feedback.setPending()
    try {
      const data = { orderItemId: line.id, sessionId, tenantId, venueId }
      if (isOnline) {
        await reactivateOrderItem({ data })
        onDone()
      } else {
        enqueueAccountOperation(
          offlineStore,
          createReactivateOrderItemOperation(crypto.randomUUID(), data),
        )
      }
      feedback.setSuccess(isOnline ? 'Activado' : 'Activado sin conexión')
    } catch {
      rollback?.()
      feedback.setError('No se ha podido activar la línea.')
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
    const groups = groupAccountLines(lines)
    return (
      <Card className="rounded-none border-0 bg-transparent shadow-none xl:flex xl:h-full xl:min-h-0 xl:flex-col">
        <CardContent className="px-0 py-0 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavía no se ha apuntado nada.</p>
          ) : (
            <ul className="divide-border/70 divide-y">
              {groups.map((group) => {
                const { line } = group
                const grossCents = group.lines.reduce(
                  (sum, groupLine) => sum + lineGrossCents(groupLine),
                  0,
                )
                const canCount = canEdit && line.status !== 'cancelled' && line.status !== 'served'
                return (
                  <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" key={group.key}>
                    {canCount ? (
                      <QuantityInput
                        aria-label={`Cantidad de ${line.name}`}
                        className="shrink-0 [&_[data-slot=quantity-input-decrement]]:size-7 [&_[data-slot=quantity-input-group]]:h-7 [&_[data-slot=quantity-input-increment]]:size-7"
                        inputClassName="w-8 text-xs"
                        isDisabled={feedback.pending || group.lines.some(isOptimisticAccountLine)}
                        minValue={1}
                        onChange={(value) => void changeGroupQuantity(group, value)}
                        value={group.quantity}
                      />
                    ) : (
                      <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums">
                        {group.quantity}
                      </span>
                    )}
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
                            <span className="text-muted-foreground block text-xs">
                              {line.notes}
                            </span>
                          )}
                          {line.modifiers?.map((modifier) => (
                            <span className="text-muted-foreground block text-xs" key={modifier.id}>
                              {`+ ${modifier.name}`}
                            </span>
                          ))}
                        </div>
                        <span className="flex shrink-0 items-center gap-1">
                          <span className="text-right font-medium tabular-nums">
                            {line.status === 'cancelled' ? '—' : formatMoney(grossCents, locale)}
                          </span>
                          {canRemove && (
                            <Button
                              aria-label={
                                line.status === 'cancelled'
                                  ? `Activar ${line.name}`
                                  : `Quitar ${line.name}`
                              }
                              disabled={
                                feedback.pending || group.lines.some(isOptimisticAccountLine)
                              }
                              onClick={() =>
                                void (line.status === 'cancelled'
                                  ? activate(line)
                                  : removeGroup(group))
                              }
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              {line.status === 'cancelled' ? (
                                <RotateCcw aria-hidden="true" className="text-primary size-4" />
                              ) : (
                                <Trash2 aria-hidden="true" className="text-destructive size-4" />
                              )}
                            </Button>
                          )}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
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
