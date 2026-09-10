import { createFileRoute } from '@tanstack/react-router'

import { getMenu } from '@/features/menu'
import { getInventory, listIngredients } from '@/features/product'
import { ChannelPriceCard } from '@/features/product/ui/channel-price-card'
import { ProductPage } from '@/features/product/ui/product-page'

export const Route = createFileRoute('/t/$slug/l/$venue/productos')({
  loader: async ({ context }) => {
    const data = { tenantId: context.tenant.id, venueId: context.venue.id }
    const [ingredients, stock, menu] = await Promise.all([
      listIngredients({ data: { tenantId: data.tenantId } }),
      getInventory({ data }),
      getMenu({ data: { tenantId: data.tenantId, venueId: data.venueId } }),
    ])
    return {
      ingredients,
      stock,
      menuItems: menu.items.map((item) => ({ id: item.id, name: item.nameI18n.es ?? item.id })),
    }
  },
  component: ProductRoute,
})
function ProductRoute() {
  const { tenant, venue } = Route.useRouteContext()
  const { ingredients, stock, menuItems } = Route.useLoaderData()
  return (
    <>
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
      />
    </>
  )
}
