import { createFileRoute } from '@tanstack/react-router'

import { getMenu, ModifierCard } from '@/features/menu'
import { getInventory, listIngredients, listSuppliers } from '@/features/product'
import { ChannelPriceCard } from '@/features/product/ui/channel-price-card'
import { ProductPage } from '@/features/product/ui/product-page'

export const Route = createFileRoute('/t/$slug/l/$venue/productos')({
  loader: async ({ context }) => {
    const data = { tenantId: context.tenant.id, venueId: context.venue.id }
    const [ingredients, stock, menu, suppliers] = await Promise.all([
      listIngredients({ data: { tenantId: data.tenantId, page: 1, pageSize: 100, search: '' } }),
      getInventory({ data }),
      getMenu({ data: { tenantId: data.tenantId, venueId: data.venueId } }),
      listSuppliers({ data: { tenantId: data.tenantId } }),
    ])
    return {
      ingredients,
      stock,
      menu,
      menuItems: menu.items.map((item) => ({ id: item.id, name: item.nameI18n.es ?? item.id })),
      suppliers,
    }
  },
  component: ProductRoute,
})
function ProductRoute() {
  const { tenant, venue } = Route.useRouteContext()
  const { ingredients, menu, stock, menuItems, suppliers } = Route.useLoaderData()
  return (
    <>
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
      />
    </>
  )
}
