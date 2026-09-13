import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { forecastDemand, forecastIngredientDemand, type ForecastDay } from '../domain/forecast'

const input = z.object({ tenantId: z.string().uuid(), venueId: z.string().uuid() })

export const getDemandForecast = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(input)
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const now = new Date()
    const historyFrom = new Date(now.getTime() - 56 * 86_400_000)
    const upcomingTo = new Date(now.getTime() + 7 * 86_400_000)
    const [sessionsResult, reservationsResult] = await Promise.all([
      supabase
        .from('table_sessions')
        .select('id, opened_at, covers')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .eq('status', 'closed')
        .gte('opened_at', historyFrom.toISOString())
        .lt('opened_at', now.toISOString()),
      supabase
        .from('reservations')
        .select('party_size')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .in('status', ['pending', 'confirmed'])
        .gte('starts_at', now.toISOString())
        .lt('starts_at', upcomingTo.toISOString()),
    ])
    if (sessionsResult.error || reservationsResult.error)
      throw new Error('demand_forecast_load_failed')
    const sessionIds = (sessionsResult.data ?? []).map((session) => session.id as string)
    const paymentsResult = sessionIds.length
      ? await supabase
          .from('payments')
          .select('session_id, amount_cents')
          .eq('tenant_id', data.tenantId)
          .in('session_id', sessionIds)
      : { data: [], error: null }
    if (paymentsResult.error) throw new Error('demand_forecast_payments_failed')
    const salesBySession = new Map<string, number>()
    for (const payment of paymentsResult.data ?? [])
      salesBySession.set(
        payment.session_id,
        (salesBySession.get(payment.session_id) ?? 0) + Number(payment.amount_cents),
      )
    const history: ForecastDay[] = (sessionsResult.data ?? []).map((session) => ({
      date: String(session.opened_at).slice(0, 10),
      covers: Number(session.covers ?? 0),
      salesCents: salesBySession.get(session.id as string) ?? 0,
    }))
    const upcomingReservations = (reservationsResult.data ?? []).reduce(
      (sum, reservation) => sum + Number(reservation.party_size),
      0,
    )
    const historicalCovers = history.reduce((sum, day) => sum + day.covers, 0)
    const historicalSales = history.reduce((sum, day) => sum + day.salesCents, 0)
    const averageSpend = historicalCovers ? Math.round(historicalSales / historicalCovers) : 0
    const ordersResult = sessionIds.length
      ? await supabase
          .from('orders')
          .select('id')
          .eq('tenant_id', data.tenantId)
          .in('session_id', sessionIds)
      : { data: [], error: null }
    if (ordersResult.error) throw new Error('demand_forecast_orders_failed')
    const orderIds = (ordersResult.data ?? []).map((order) => order.id as string)
    const [itemsResult, recipesResult] = orderIds.length
      ? await Promise.all([
          supabase
            .from('order_items')
            .select('menu_item_id, quantity')
            .eq('tenant_id', data.tenantId)
            .in('order_id', orderIds)
            .neq('status', 'cancelled'),
          supabase
            .from('recipe_ingredients')
            .select('menu_item_id, ingredient_id, quantity')
            .eq('tenant_id', data.tenantId),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ]
    if (itemsResult.error || recipesResult.error) throw new Error('demand_forecast_recipes_failed')
    const recipes = new Map<string, { ingredientId: string; quantity: number }[]>()
    for (const recipe of recipesResult.data ?? [])
      recipes.set(recipe.menu_item_id, [
        ...(recipes.get(recipe.menu_item_id) ?? []),
        { ingredientId: recipe.ingredient_id, quantity: Number(recipe.quantity) },
      ])
    const soldRecipes: { ingredientId: string; quantity: number }[] = []
    for (const item of itemsResult.data ?? [])
      for (const recipe of recipes.get(item.menu_item_id) ?? [])
        soldRecipes.push({
          ingredientId: recipe.ingredientId,
          quantity: recipe.quantity * Number(item.quantity),
        })
    const result = forecastDemand(history, upcomingReservations, averageSpend)
    return {
      ...result,
      ingredientDemand: forecastIngredientDemand(
        historicalCovers,
        soldRecipes,
        result.expectedCovers,
      ),
    }
  })
