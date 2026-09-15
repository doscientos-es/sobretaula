import { queryOptions } from '@tanstack/react-query'

import { getDemandForecast } from '@/features/forecasting'
import { getMenu } from '@/features/menu/application/menu'

import { getInventory, listIngredients, listPurchaseOrders, listSuppliers } from './product'

const emptyForecast = {
  confidence: 'low' as const,
  expectedCovers: 0,
  expectedSalesCents: 0,
  ingredientDemand: {},
  sources: ['Sin datos de previsión'],
}

/** Caches the stable product workspace as one screen-level query. */
export function productWorkspaceQuery(tenantId: string, venueId: string) {
  return queryOptions({
    queryFn: async () => {
      const data = { tenantId, venueId }
      const [ingredients, stock, menu, suppliers, forecast, purchaseOrders] = await Promise.all([
        listIngredients({ data: { ...data, page: 1, pageSize: 100, search: '' } }),
        getInventory({ data }),
        getMenu({ data }),
        listSuppliers({ data: { ...data, page: 1, pageSize: 100, search: '' } }),
        getDemandForecast({ data }).catch(() => emptyForecast),
        listPurchaseOrders({ data: { ...data, page: 1, pageSize: 25 } }).catch(() => ({
          hasMore: false,
          items: [],
          page: 1,
          pageSize: 25,
          total: 0,
        })),
      ])
      return {
        ingredients,
        menu,
        menuItems: menu.items.map((item) => ({ id: item.id, name: item.nameI18n.es ?? item.id })),
        purchaseOrders,
        stock,
        suppliers,
        forecast,
      }
    },
    queryKey: ['tenant', tenantId, 'venue', venueId, 'products-workspace'],
    staleTime: 30_000,
  })
}
