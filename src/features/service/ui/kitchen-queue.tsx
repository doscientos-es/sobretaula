import { Button, Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'
import { useState } from 'react'
import { updateOrderItemStatus } from '@/features/account/application/account'
import type { KitchenTicket } from '../domain/service-board'

const nextStatus: Record<KitchenTicket['status'], KitchenTicket['status'] | null> = {
  pending: 'preparing', preparing: 'ready', ready: 'served', served: null, cancelled: null,
}

export function KitchenQueue({ tickets, tenantId, venueId, onDone }: { tickets: readonly KitchenTicket[]; tenantId: string; venueId: string; onDone: () => void }) {
  const active = tickets.filter((ticket) => ticket.status !== 'served' && ticket.status !== 'cancelled')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function advance(ticket: KitchenTicket, status: KitchenTicket['status']) {
    if (pendingId) return
    setPendingId(ticket.id)
    setError(null)
    try {
      await updateOrderItemStatus({ data: { orderItemId: ticket.id, sessionId: ticket.sessionId, status, tenantId, venueId } })
      onDone()
    } catch {
      setError('No se ha podido actualizar el estado de la comanda.')
    } finally {
      setPendingId(null)
    }
  }
  return <Card>
    <CardHeader><CardTitle>Cocina y barra</CardTitle></CardHeader>
    <CardContent className="grid gap-3 md:grid-cols-2">
      {active.length === 0 ? <p className="text-muted-foreground text-sm">No hay platos pendientes.</p> : active.map((ticket) => {
        const next = nextStatus[ticket.status]
        return <div className="rounded-lg border p-3" key={ticket.id}>
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{ticket.quantity} × {ticket.name}</p><p className="text-muted-foreground text-xs">{ticket.station} · {ticket.status}</p>{ticket.notes && <p className="text-muted-foreground text-xs">{ticket.notes}</p>}</div>
          {next && <Button disabled={pendingId === ticket.id} size="sm" type="button" onClick={() => void advance(ticket, next)}>Marcar {next}</Button>}</div>
        </div>
      })}
      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
    </CardContent>
  </Card>
}
