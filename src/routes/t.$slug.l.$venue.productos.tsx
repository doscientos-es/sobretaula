import { createFileRoute, notFound } from '@tanstack/react-router'

import { getDemandForecast } from '@/features/forecasting'
import { getMenu, ModifierCard } from '@/features/menu'
import {
  getInventory,
  listIngredients,
  listPurchaseOrders,
  listSuppliers,
} from '@/features/product'
import { ChannelPriceCard } from '@/features/product/ui/channel-price-card'
import { ProductPage } from '@/features/product/ui/product-page'
import { PurchaseOrdersPage } from '@/features/product/ui/purchase-orders-page'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/productos')({
  loader: async ({ params }) => {
    const routeContext = await loadVenueRouteContext(params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    const data = { tenantId: tenant.id, venueId: venue.id }
    const [ingredients, stock, menu, suppliers, forecast, purchaseOrders] = await Promise.all([
      listIngredients({
        data: {
          tenantId: data.tenantId,
          venueId: data.venueId,
          page: 1,
          pageSize: 100,
          search: '',
        },
      }),
      getInventory({ data: { tenantId: data.tenantId, venueId: data.venueId } }),
      getMenu({ data: { tenantId: data.tenantId, venueId: data.venueId } }),
      listSuppliers({
        data: {
          tenantId: data.tenantId,
          venueId: data.venueId,
          page: 1,
          pageSize: 100,
          search: '',
        },
      }),
      getDemandForecast({ data: { tenantId: data.tenantId, venueId: data.venueId } }).catch(() => ({
        expectedCovers: 0,
        expectedSalesCents: 0,
        confidence: 'low' as const,
        sources: ['Sin datos de previsión'],
        ingredientDemand: {},
      })),
      listPurchaseOrders({ data }).catch(() => ({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        hasMore: false,
      })),
    ])
    return {
      ingredients,
      stock,
      menu,
      menuItems: menu.items.map((item) => ({ id: item.id, name: item.nameI18n.es ?? item.id })),
      suppliers,
      forecast,
      purchaseOrders,
      tenant,
      venue,
    }
  },
  component: ProductRoute,
})
function ProductRoute() {
  const {
    ingredients,
    menu,
    menuItems,
    stock,
    suppliers,
    forecast,
    purchaseOrders,
    tenant,
    venue,
  } = Route.useLoaderData()
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
