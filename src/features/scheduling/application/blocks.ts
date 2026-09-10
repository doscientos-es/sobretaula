import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'
const base = z.object({ tenantId: z.string().uuid(), venueId: z.string().uuid() })
const createInput = base.extend({
  areaId: z.string().uuid().nullable().optional(),
  blockType: z.enum(['closure', 'vacation', 'private_event', 'maintenance', 'last_minute']),
  title: z.string().trim().min(1).max(120),
  internalNote: z.string().trim().max(2000).optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  visibleOnline: z.boolean().default(true),
})
export interface SchedulingBlock {
  id: string
  areaId: string | null
  blockType: string
  title: string
  startsAt: string
  endsAt: string
  visibleOnline: boolean
}
export interface SchedulingArea {
  id: string
  name: string
}
export const getSchedulingAreas = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(base)
  .handler(async ({ context, data }): Promise<SchedulingArea[]> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: areas, error } = await supabase
      .from('areas')
      .select('id, name')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .order('name')
    if (error) throw new Error(`scheduling_areas_load_failed:${error.code}`)
    return areas ?? []
  })
export const getSchedulingBlocks = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(base)
  .handler(async ({ context, data }): Promise<SchedulingBlock[]> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: blocks, error } = await supabase
      .from('scheduling_blocks')
      .select('area_id, block_type, id, period, title, visible_online')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .order('period')
    if (error) throw new Error(`scheduling_blocks_load_failed:${error.code}`)
    return (blocks ?? []).map((block) => {
      const [startsAt, endsAt] = block.period.slice(1, -1).split(',')
      return {
        id: block.id,
        areaId: block.area_id,
        blockType: block.block_type,
        title: block.title,
        startsAt,
        endsAt,
        visibleOnline: block.visible_online,
      }
    })
  })

export const deleteSchedulingBlock = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(
    z.object({
      tenantId: z.string().uuid(),
      venueId: z.string().uuid(),
      blockId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { error } = await supabase
      .from('scheduling_blocks')
      .delete()
      .eq('id', data.blockId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (error) throw new Error(`scheduling_block_delete_failed:${error.code}`)
  })
export const createSchedulingBlock = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(createInput)
  .handler(async ({ context, data }) => {
    if (new Date(data.endsAt) <= new Date(data.startsAt))
      throw new Response('Invalid period', { status: 422 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { error } = await supabase.from('scheduling_blocks').insert({
      tenant_id: data.tenantId,
      venue_id: data.venueId,
      area_id: data.areaId ?? null,
      block_type: data.blockType,
      title: data.title,
      internal_note: data.internalNote ?? null,
      period: `[${data.startsAt},${data.endsAt})`,
      visible_online: data.visibleOnline,
      created_by: context.principal.userId,
    })
    if (error) throw new Error(`scheduling_block_create_failed:${error.code}`)
  })
