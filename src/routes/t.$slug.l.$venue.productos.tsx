import { createFileRoute } from '@tanstack/react-router'

import { getDemandForecast } from '@/features/forecasting'
import { getMenu } from '@/features/menu/application/menu'
import {
  getInventory,
  listIngredients,
  listPurchaseOrders,
  listSuppliers,
} from '@/features/product/application/product'

export const Route = createFileRoute('/t/$slug/l/$venue/productos')({
  loader: async ({ context }) => {
    const { tenant, venue } = context
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
})
