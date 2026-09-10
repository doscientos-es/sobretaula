import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { operationalTenantMiddleware, tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'
import { channelPriceInput } from '@/features/product/application/product-schema'

export const setMenuChannelPrice = createServerFn({ method: 'POST' }).middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware]).validator(channelPriceInput).handler(async ({ context, data }) => {
  if (!['owner', 'manager'].includes(context.tenantMembership.role)) throw new Response('Forbidden', { status: 403 })
  const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).from('menu_item_channel_prices').upsert({ tenant_id: data.tenantId, menu_item_id: data.menuItemId, channel: data.channel, price_cents: data.priceCents }, { onConflict: 'tenant_id,menu_item_id,channel' })
  if (error) throw new Error(`menu_channel_price_failed:${error.code}`)
  return { menuItemId: data.menuItemId, channel: data.channel, priceCents: data.priceCents }
})
