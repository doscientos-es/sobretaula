import { Button, Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'
import { useCallback, useState } from 'react'

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

import { listOnlineOrders, updateOnlineOrderStatus } from '../application/online-orders'
import type { OnlineOrderStatus } from '../domain/order-status'
type Order = Awaited<ReturnType<typeof listOnlineOrders>>['items'][number]
const next: Partial<Record<OnlineOrderStatus, OnlineOrderStatus>> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'completed',
}
export function OnlineOrdersPage({ tenantId, venueId }: { tenantId: string; venueId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOnlineOrders({
        data: { page, pageSize: 25, tenantId, venueId },
      })
      setOrders(result.items)
      setTotal(result.total)
      setError(null)
    } catch {
      setError('No se han podido cargar los pedidos online.')
    } finally {
      setLoading(false)
    }
  }, [page, tenantId, venueId])
  useAsyncEffect(load, [load])
  async function advance(order: Order) {
    const status = next[order.status as OnlineOrderStatus]
    if (!status) return
    setBusyOrderId(order.id)
    try {
      await updateOnlineOrderStatus({
        data: { tenantId, venueId, orderId: order.id, status },
      })
      await load()
    } catch {
      setError('No se ha podido actualizar el pedido.')
    } finally {
      setBusyOrderId(null)
    }
  }
  const labels = {
    pending: 'Pendientes',
    accepted: 'Aceptados',
    preparing: 'Preparando',
    ready: 'Listos',
    completed: 'Completados',
  }
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Pedidos online</h1>
        <p className="text-muted-foreground text-sm">
          Gestiona recogidas y delivery desde la misma cola operativa.
        </p>
      </div>
      {error && (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-destructive text-sm">{error}</p>
          <Button onClick={() => void load()} size="sm" type="button" variant="outline">
            Reintentar
          </Button>
        </div>
      )}
      {loading ? (
        <div
          aria-busy="true"
          aria-label="Cargando pedidos online"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div className="border-border/70 h-36 animate-pulse rounded-xl border" key={index} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {(Object.keys(labels) as Array<keyof typeof labels>).map((status) => (
            <Card key={status}>
              <CardHeader>
                <CardTitle>{labels[status]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {orders
                  .filter((order) => order.status === status)
                  .map((order) => (
                    <article className="rounded-md border p-3 text-sm" key={order.id}>
                      <p className="font-medium">
                        {order.customer_name} · {(order.total_cents / 100).toFixed(2)} €
                      </p>
                      <p className="text-muted-foreground">
                        {order.channel}
                        {order.requested_for
                          ? ` · ${new Date(order.requested_for).toLocaleString('es-ES')}`
                          : ''}
                      </p>
                      <Button
                        className="mt-2"
                        disabled={status === 'completed' || busyOrderId === order.id}
                        onClick={() => void advance(order)}
                        size="sm"
                        type="button"
                      >
                        {busyOrderId === order.id
                          ? 'Guardando…'
                          : status === 'completed'
                            ? 'Completado'
                            : status === 'pending'
                              ? 'Aceptar'
                              : status === 'accepted'
                                ? 'Enviar a cocina'
                                : status === 'preparing'
                                  ? 'Marcar listo'
                                  : 'Completar'}
                      </Button>
                    </article>
                  ))}
                {orders.filter((order) => order.status === status).length === 0 && (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    No hay pedidos en este estado.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {total > 25 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{total} pedidos</span>
          <div className="flex gap-2">
            <Button
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
              size="sm"
              type="button"
            >
              Anterior
            </Button>
            <Button
              disabled={page * 25 >= total}
              onClick={() => setPage((value) => value + 1)}
              size="sm"
              type="button"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
