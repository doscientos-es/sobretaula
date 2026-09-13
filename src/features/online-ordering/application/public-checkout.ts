import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { createAnonSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  calculateOnlineOrderTotal,
  validateOnlineOrderLines,
  type OnlineOrderLine,
} from '../domain/order-total'
const input = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
  customerName: z.string().trim().min(1).max(160),
  customerPhone: z.string().trim().max(40).optional(),
  channel: z.enum(['pickup', 'delivery']),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        name: z.string(),
        quantity: z.number(),
        unitPriceCents: z.number().int(),
      }),
    )
    .min(1),
  requestedFor: z.string().datetime().optional(),
  idempotencyKey: z.string().uuid(),
})
export const createPublicOnlineOrder = createServerFn({ method: 'POST' })
  .validator(input)
  .handler(async ({ data }) => {
    const lines = data.items as OnlineOrderLine[]
    const invalid = validateOnlineOrderLines(lines)
    if (invalid) throw new Error(invalid)
    const total = calculateOnlineOrderTotal(lines)
    const { data: orderId, error } = await createAnonSupabaseClient().rpc(
      'create_public_online_order',
      {
        p_tenant_id: data.tenantId,
        p_venue_id: data.venueId,
        p_customer_name: data.customerName,
        p_customer_phone: data.customerPhone ?? null,
        p_channel: data.channel,
        p_items: lines,
        p_requested_for: data.requestedFor ?? null,
        p_idempotency_key: data.idempotencyKey,
      },
    )
    if (error) throw new Error(`public_online_order_failed:${error.code}`)
    return { orderId: orderId as string, totalCents: total }
  })
