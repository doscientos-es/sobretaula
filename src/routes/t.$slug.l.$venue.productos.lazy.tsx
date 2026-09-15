import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { ModifierCard } from '@/features/menu'
import { productWorkspaceQuery } from '@/features/product/application/product-workspace'
import { ChannelPriceCard } from '@/features/product/ui/channel-price-card'
import { ProductPage } from '@/features/product/ui/product-page'
import { PurchaseOrdersPage } from '@/features/product/ui/purchase-orders-page'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/productos')({
  component: ProductRoute,
})

function ProductRoute() {
  const { tenant, venue } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const reload = useLoaderReload()
  const workspace = useQuery(productWorkspaceQuery(tenant.id, venue.id))
  if (workspace.isPending) return <TenantRoutePending />
  if (workspace.error) throw workspace.error
  const { ingredients, menu, menuItems, stock, suppliers, purchaseOrders } =
    workspace.data
  const onDone = () => {
    void queryClient
      .invalidateQueries({ queryKey: productWorkspaceQuery(tenant.id, venue.id).queryKey })
      .then(reload)
  }
  return (
    <>
      <PurchaseOrdersPage
        orders={purchaseOrders}
        tenantId={tenant.id}
        suppliers={suppliers.items}
        onDone={onDone}
      />
      <ModifierCard
        ingredients={ingredients.items}
        menu={menu}
        onDone={onDone}
        tenantId={tenant.id}
      />
      <ChannelPriceCard
        menuItems={menuItems}
        tenantId={tenant.id}
        venueId={venue.id}
        onDone={onDone}
      />
      <ProductPage
        ingredients={ingredients}
        stock={stock}
        menuItems={menuItems}
        tenantId={tenant.id}
        venueId={venue.id}
        onDone={onDone}
        suppliers={suppliers}
        purchaseOrders={purchaseOrders}
      />
    </>
  )
}
