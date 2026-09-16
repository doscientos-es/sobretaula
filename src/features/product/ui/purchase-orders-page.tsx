import { Button, Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'
import { useState } from 'react'

import { updatePurchaseOrderStatus, type listPurchaseOrders } from '../application/product'
import type { PurchaseOrderStatus } from '../domain/purchase-order'

type ApiPurchaseOrderStatus = Exclude<PurchaseOrderStatus, 'draft'>

export function PurchaseOrdersPage({
  orders,
  tenantId,
  suppliers,
  onDone,
}: {
  orders: Awaited<ReturnType<typeof listPurchaseOrders>>
  tenantId: string
  suppliers: Array<{ id: string; name: string }>
  onDone: () => void
}) {
  const items = orders.items
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  async function advance(id: string, status: ApiPurchaseOrderStatus) {
    if (pendingAction) return
    setPendingAction(`${id}:${status}`)
    setFeedback(null)
    try {
      await updatePurchaseOrderStatus({
        data: {
          tenantId,
          purchaseOrderId: id,
          status: status as 'approved' | 'sent' | 'received' | 'cancelled',
        },
      })
      onDone()
    } catch {
      setFeedback('No se ha podido actualizar el pedido de compra. Inténtalo de nuevo.')
    } finally {
      setPendingAction(null)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos de compra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {feedback ? (
          <div
            className="text-destructive border-destructive/30 bg-destructive/5 rounded-md border px-3 py-2 text-sm"
            role="alert"
          >
            {feedback}
          </div>
        ) : null}
        {!items.length ? (
          <p className="text-muted-foreground text-sm">Todavía no hay pedidos de compra.</p>
        ) : (
          items.map((order) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              key={order.id}
            >
              <div>
                <p className="font-medium">
                  {suppliers.find((supplier) => supplier.id === order.supplierId)?.name ??
                    'Proveedor'}
                </p>
                <p className="text-muted-foreground text-sm">
                  {order.lines.length} ingredientes · {order.status}
                </p>
              </div>
              <div className="flex gap-2">
                {order.status === 'draft' ? (
                  <Button
                    disabled={pendingAction !== null}
                    onClick={() => void advance(order.id, 'approved')}
                    size="sm"
                    type="button"
                  >
                    {pendingAction === `${order.id}:approved` ? 'Aprobando…' : 'Aprobar'}
                  </Button>
                ) : null}
                {order.status === 'approved' ? (
                  <Button
                    disabled={pendingAction !== null}
                    onClick={() => void advance(order.id, 'sent')}
                    size="sm"
                    type="button"
                  >
                    {pendingAction === `${order.id}:sent` ? 'Actualizando…' : 'Marcar enviado'}
                  </Button>
                ) : null}
                {['draft', 'approved'].includes(order.status) ? (
                  <Button
                    disabled={pendingAction !== null}
                    onClick={() => void advance(order.id, 'cancelled')}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {pendingAction === `${order.id}:cancelled` ? 'Cancelando…' : 'Cancelar'}
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
