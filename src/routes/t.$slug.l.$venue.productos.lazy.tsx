import { createLazyFileRoute } from '@tanstack/react-router'

import { ModifierCard } from '@/features/menu'
import { ChannelPriceCard } from '@/features/product/ui/channel-price-card'
import { ProductPage } from '@/features/product/ui/product-page'
import { PurchaseOrdersPage } from '@/features/product/ui/purchase-orders-page'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/productos')({
  component: ProductRoute,
})

function ProductRoute() {
  const { ingredients, menu, menuItems, stock, suppliers, forecast, purchaseOrders, tenant, venue } =
    Route.useLoaderData()
  return (
    <>
      <PurchaseOrdersPage
        orders={purchaseOrders}
        tenantId={tenant.id}
        suppliers={suppliers.items}
        onDone={() => window.location.reload()}
      />
      <ModifierCard
        ingredients={ingredients.items}
        menu={menu}
        onDone={() => window.location.reload()}
        tenantId={tenant.id}
      />
      <ChannelPriceCard
        menuItems={menuItems}
        tenantId={tenant.id}
        venueId={venue.id}
        onDone={() => window.location.reload()}
      />
      <ProductPage
        ingredients={ingredients}
        stock={stock}
        menuItems={menuItems}
        tenantId={tenant.id}
        venueId={venue.id}
        onDone={() => window.location.reload()}
        suppliers={suppliers}
        forecast={forecast}
        purchaseOrders={purchaseOrders}
      />
    </>
  )
}
