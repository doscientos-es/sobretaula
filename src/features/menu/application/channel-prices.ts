import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { menuChannelPriceInput } from './menu-schema'

export const setMenuChannelPrice = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(menuChannelPriceInput)
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const table = data.venueId ? 'menu_item_venue_prices' : 'menu_item_channel_prices'
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from(table)
      .upsert(
        {
          ...(data.venueId ? { venue_id: data.venueId } : {}),
          tenant_id: data.tenantId,
          menu_item_id: data.menuItemId,
          channel: data.channel,
          price_cents: data.priceCents,
          ...(data.venueId ? { is_available: data.isAvailable ?? true } : {}),
        },
        {
          onConflict: data.venueId
            ? 'tenant_id,venue_id,menu_item_id,channel'
            : 'tenant_id,menu_item_id,channel',
        },
      )
    if (error) throw new Error(`menu_channel_price_failed:${error.code}`)
    return {
      channel: data.channel,
      isAvailable: data.isAvailable ?? true,
      menuItemId: data.menuItemId,
      priceCents: data.priceCents,
      venueId: data.venueId,
    }
  })
