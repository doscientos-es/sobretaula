import { Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'

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
  async function advance(id: string, status: ApiPurchaseOrderStatus) {
    await updatePurchaseOrderStatus({
      data: {
        tenantId,
        purchaseOrderId: id,
        status: status as 'approved' | 'sent' | 'received' | 'cancelled',
      },
    })
    onDone()
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos de compra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
                  <button
                    className="bg-primary text-primary-foreground rounded px-3 py-1 text-sm"
                    onClick={() => void advance(order.id, 'approved')}
                    type="button"
                  >
                    Aprobar
                  </button>
                ) : null}
                {order.status === 'approved' ? (
                  <button
                    className="bg-primary text-primary-foreground rounded px-3 py-1 text-sm"
                    onClick={() => void advance(order.id, 'sent')}
                    type="button"
                  >
                    Marcar enviado
                  </button>
                ) : null}
                {['draft', 'approved'].includes(order.status) ? (
                  <button
                    className="rounded border px-3 py-1 text-sm"
                    onClick={() => void advance(order.id, 'cancelled')}
                    type="button"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
