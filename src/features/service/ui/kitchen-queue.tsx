import { Button, Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'
import { updateOrderItemStatus } from '@/features/account/application/account'
import type { KitchenTicket } from '../domain/service-board'

const nextStatus: Record<KitchenTicket['status'], KitchenTicket['status'] | null> = {
  pending: 'preparing', preparing: 'ready', ready: 'served', served: null, cancelled: null,
}

export function KitchenQueue({ tickets, tenantId, venueId, onDone }: { tickets: readonly KitchenTicket[]; tenantId: string; venueId: string; onDone: () => void }) {
  const active = tickets.filter((ticket) => ticket.status !== 'served' && ticket.status !== 'cancelled')
  return <Card>
    <CardHeader><CardTitle>Cocina y barra</CardTitle></CardHeader>
    <CardContent className="grid gap-3 md:grid-cols-2">
      {active.length === 0 ? <p className="text-muted-foreground text-sm">No hay platos pendientes.</p> : active.map((ticket) => {
        const next = nextStatus[ticket.status]
        return <div className="rounded-lg border p-3" key={ticket.id}>
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{ticket.quantity} × {ticket.name}</p><p className="text-muted-foreground text-xs">{ticket.station} · {ticket.status}</p>{ticket.notes && <p className="text-muted-foreground text-xs">{ticket.notes}</p>}</div>
          {next && <Button size="sm" type="button" onClick={() => void updateOrderItemStatus({ data: { orderItemId: ticket.id, sessionId: ticket.sessionId, status: next, tenantId, venueId } }).then(onDone)}>Marcar {next}</Button>}</div>
        </div>
      })}
    </CardContent>
  </Card>
}
