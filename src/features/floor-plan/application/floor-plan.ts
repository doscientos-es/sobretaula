import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { FloorPlanData } from '../domain/floor-plan'
import { findPlacementCollisions, isPlacementWithinBounds } from '../domain/geometry'

const tenantInput = z.object({ tenantId: z.string().uuid() })
const initialFloorPlanInput = tenantInput.extend({
  areaName: z.string().trim().min(1).max(100),
  heightCm: z.number().int().min(100).max(10_000),
  venueName: z.string().trim().min(1).max(100),
  widthCm: z.number().int().min(100).max(10_000),
})
const createTableInput = tenantInput
  .extend({
    areaId: z.string().uuid(),
    code: z.string().trim().min(1).max(20),
    heightCm: z.number().int().min(25).max(500),
    maxSeats: z.number().int().min(1).max(50),
    minSeats: z.number().int().min(1).max(50),
    rotationDeg: z.number().int().min(0).max(359).default(0),
    shape: z.enum(['square', 'rectangle', 'round', 'oval', 'custom']).default('square'),
    venueId: z.string().uuid(),
    versionId: z.string().uuid(),
    widthCm: z.number().int().min(25).max(500),
    xCm: z.number().int().min(0).max(10_000),
    yCm: z.number().int().min(0).max(10_000),
  })
  .refine((table) => table.maxSeats >= table.minSeats, {
    message: 'max_seats_must_not_be_lower_than_min_seats',
    path: ['maxSeats'],
  })
const placementInput = z.object({
  heightCm: z.number().int().min(25).max(500),
  id: z.string().uuid(),
  rotationDeg: z.number().int().min(0).max(359),
  widthCm: z.number().int().min(25).max(500),
  xCm: z.number().int().min(0).max(10_000),
  yCm: z.number().int().min(0).max(10_000),
})
const planElementInput = z.object({
  heightCm: z.number().int().min(1).max(10_000),
  kind: z.enum(['wall', 'door', 'window', 'bar', 'stairs', 'plant', 'label', 'other']),
  label: z.string().trim().max(100).nullable(),
  rotationDeg: z.number().int().min(0).max(359),
  widthCm: z.number().int().min(1).max(10_000),
  xCm: z.number().int().min(0).max(10_000),
  yCm: z.number().int().min(0).max(10_000),
})
const saveFloorPlanVersionInput = tenantInput.extend({
  activeFrom: z.string().datetime({ offset: true }),
  elements: z.array(planElementInput).max(100),
  name: z.string().trim().min(1).max(100),
  placements: z.array(placementInput).max(150),
  sourceVersionId: z.string().uuid(),
})

function requireManager(role: string): void {
  if (role !== 'owner' && role !== 'manager') throw new Response('Forbidden', { status: 403 })
}

export const getFloorPlan = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(tenantInput)
  .handler(async ({ context, data }): Promise<FloorPlanData> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [areasResult, versionsResult, tablesResult, placementsResult, elementsResult] =
      await Promise.all([
        supabase
          .from('areas')
          .select('id, is_online_bookable, name, venue_id')
          .eq('tenant_id', data.tenantId)
          .order('name'),
        supabase
          .from('floor_plan_versions')
          .select('area_id, height_cm, id, name, width_cm')
          .eq('tenant_id', data.tenantId)
          .lte('active_from', new Date().toISOString())
          .or(`active_to.is.null,active_to.gt.${new Date().toISOString()}`)
          .order('active_from', { ascending: false }),
        supabase.from('tables').select('code, id').eq('tenant_id', data.tenantId),
        supabase
          .from('table_placements')
          .select(
            'floor_plan_version_id, height_cm, id, rotation_deg, table_id, width_cm, x_cm, y_cm',
          )
          .eq('tenant_id', data.tenantId),
        supabase
          .from('plan_elements')
          .select(
            'floor_plan_version_id, height_cm, id, kind, label, rotation_deg, width_cm, x_cm, y_cm',
          )
          .eq('tenant_id', data.tenantId),
      ])

    const error = [
      areasResult.error,
      versionsResult.error,
      tablesResult.error,
      placementsResult.error,
      elementsResult.error,
    ].find(Boolean)
    if (error) throw new Error(`floor_plan_load_failed:${error.code}`)

    const tableCodes = new Map((tablesResult.data ?? []).map((table) => [table.id, table.code]))

    return {
      areas: (areasResult.data ?? []).map((area) => ({
        id: area.id,
        isOnlineBookable: area.is_online_bookable,
        name: area.name,
        venueId: area.venue_id,
      })),
      elements: (elementsResult.data ?? []).map((element) => ({
        floorPlanVersionId: element.floor_plan_version_id,
        heightCm: element.height_cm,
        id: element.id,
        kind: element.kind,
        label: element.label,
        rotationDeg: element.rotation_deg,
        widthCm: element.width_cm,
        xCm: element.x_cm,
        yCm: element.y_cm,
      })),
      placements: (placementsResult.data ?? []).map((placement) => ({
        code: tableCodes.get(placement.table_id) ?? '—',
        floorPlanVersionId: placement.floor_plan_version_id,
        heightCm: placement.height_cm,
        id: placement.table_id,
        rotationDeg: placement.rotation_deg,
        widthCm: placement.width_cm,
        xCm: placement.x_cm,
        yCm: placement.y_cm,
      })),
      versions: (versionsResult.data ?? []).map((version) => ({
        areaId: version.area_id,
        heightCm: version.height_cm,
        id: version.id,
        name: version.name,
        widthCm: version.width_cm,
      })),
    }
  })

export const createInitialFloorPlan = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(initialFloorPlanInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .insert({ name: data.venueName, tenant_id: data.tenantId })
      .select('id')
      .single()
    if (venueError || !venue)
      throw new Error(`floor_plan_venue_create_failed:${venueError?.code ?? 'unknown'}`)

    const { data: area, error: areaError } = await supabase
      .from('areas')
      .insert({ name: data.areaName, tenant_id: data.tenantId, venue_id: venue.id })
      .select('id')
      .single()
    if (areaError || !area)
      throw new Error(`floor_plan_area_create_failed:${areaError?.code ?? 'unknown'}`)

    const { data: version, error: versionError } = await supabase
      .from('floor_plan_versions')
      .insert({
        area_id: area.id,
        created_by: context.tenantMembership.userId,
        height_cm: data.heightCm,
        name: 'Plano inicial',
        tenant_id: data.tenantId,
        width_cm: data.widthCm,
      })
      .select('id')
      .single()
    if (versionError || !version) {
      throw new Error(`floor_plan_version_create_failed:${versionError?.code ?? 'unknown'}`)
    }

    return { areaId: area.id, versionId: version.id }
  })

export const createFloorPlanTable = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(createTableInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: version, error: versionError } = await supabase
      .from('floor_plan_versions')
      .select('height_cm, width_cm')
      .eq('id', data.versionId)
      .eq('tenant_id', data.tenantId)
      .eq('area_id', data.areaId)
      .single()
    if (versionError || !version) throw new Response('Not found', { status: 404 })

    const { data: existing, error: placementsError } = await supabase
      .from('table_placements')
      .select('height_cm, rotation_deg, table_id, width_cm, x_cm, y_cm')
      .eq('floor_plan_version_id', data.versionId)
    if (placementsError)
      throw new Error(`floor_plan_placements_load_failed:${placementsError.code}`)

    const placement = {
      heightCm: data.heightCm,
      id: 'new-table',
      rotationDeg: data.rotationDeg,
      widthCm: data.widthCm,
      xCm: data.xCm,
      yCm: data.yCm,
    }
    const existingPlacements = (existing ?? []).map((current) => ({
      heightCm: current.height_cm,
      id: current.table_id,
      rotationDeg: current.rotation_deg,
      widthCm: current.width_cm,
      xCm: current.x_cm,
      yCm: current.y_cm,
    }))
    if (
      !isPlacementWithinBounds(placement, {
        heightCm: version.height_cm,
        widthCm: version.width_cm,
      }) ||
      findPlacementCollisions(placement, existingPlacements).length > 0
    ) {
      throw new Response('Invalid placement', { status: 422 })
    }

    const { data: table, error: tableError } = await supabase
      .from('tables')
      .insert({
        area_id: data.areaId,
        code: data.code,
        max_seats: data.maxSeats,
        min_seats: data.minSeats,
        shape: data.shape,
        tenant_id: data.tenantId,
        venue_id: data.venueId,
      })
      .select('id')
      .single()
    if (tableError || !table)
      throw new Error(`floor_plan_table_create_failed:${tableError?.code ?? 'unknown'}`)

    const { error: placementError } = await supabase.from('table_placements').insert({
      floor_plan_version_id: data.versionId,
      height_cm: data.heightCm,
      rotation_deg: data.rotationDeg,
      table_id: table.id,
      tenant_id: data.tenantId,
      width_cm: data.widthCm,
      x_cm: data.xCm,
      y_cm: data.yCm,
    })
    if (placementError) {
      await supabase.from('tables').delete().eq('id', table.id)
      throw new Error(`floor_plan_placement_create_failed:${placementError.code}`)
    }

    return { tableId: table.id }
  })

/** Saves the editor state as a new version instead of mutating a published layout. */
export const saveFloorPlanVersion = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(saveFloorPlanVersionInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: source, error: sourceError } = await supabase
      .from('floor_plan_versions')
      .select('area_id, height_cm, id, width_cm')
      .eq('id', data.sourceVersionId)
      .eq('tenant_id', data.tenantId)
      .single()
    if (sourceError || !source) throw new Response('Not found', { status: 404 })

    const bounds = { heightCm: source.height_cm, widthCm: source.width_cm }
    if (
      data.placements.some((placement) => !isPlacementWithinBounds(placement, bounds)) ||
      data.placements.some(
        (placement) => findPlacementCollisions(placement, data.placements).length > 0,
      ) ||
      data.elements.some(
        (element) => !isPlacementWithinBounds({ ...element, id: 'plan-element' }, bounds),
      )
    ) {
      throw new Response('Invalid layout', { status: 422 })
    }

    const tableIds = data.placements.map((placement) => placement.id)
    if (new Set(tableIds).size !== tableIds.length)
      throw new Response('Invalid layout', { status: 422 })
    if (tableIds.length > 0) {
      const { data: tables, error: tablesError } = await supabase
        .from('tables')
        .select('id')
        .eq('tenant_id', data.tenantId)
        .eq('area_id', source.area_id)
        .in('id', tableIds)
      if (tablesError || (tables?.length ?? 0) !== tableIds.length) {
        throw new Response('Invalid layout', { status: 422 })
      }
    }

    const { data: version, error: versionError } = await supabase
      .from('floor_plan_versions')
      .insert({
        area_id: source.area_id,
        active_from: data.activeFrom,
        created_by: context.tenantMembership.userId,
        height_cm: source.height_cm,
        name: data.name,
        tenant_id: data.tenantId,
        width_cm: source.width_cm,
      })
      .select('id')
      .single()
    if (versionError || !version) {
      throw new Error(`floor_plan_version_create_failed:${versionError?.code ?? 'unknown'}`)
    }

    const [placementsResult, elementsResult] = await Promise.all([
      data.placements.length === 0
        ? Promise.resolve({ error: null })
        : supabase.from('table_placements').insert(
            data.placements.map((placement) => ({
              floor_plan_version_id: version.id,
              height_cm: placement.heightCm,
              rotation_deg: placement.rotationDeg,
              table_id: placement.id,
              tenant_id: data.tenantId,
              width_cm: placement.widthCm,
              x_cm: placement.xCm,
              y_cm: placement.yCm,
            })),
          ),
      data.elements.length === 0
        ? Promise.resolve({ error: null })
        : supabase.from('plan_elements').insert(
            data.elements.map((element) => ({
              floor_plan_version_id: version.id,
              height_cm: element.heightCm,
              kind: element.kind,
              label: element.label,
              rotation_deg: element.rotationDeg,
              tenant_id: data.tenantId,
              width_cm: element.widthCm,
              x_cm: element.xCm,
              y_cm: element.yCm,
            })),
          ),
    ])
    if (placementsResult.error || elementsResult.error) {
      await supabase.from('floor_plan_versions').delete().eq('id', version.id)
      throw new Error('floor_plan_version_content_create_failed')
    }

    const { error: deactivateError } = await supabase
      .from('floor_plan_versions')
      .update({ active_to: data.activeFrom })
      .eq('id', source.id)
    if (deactivateError)
      throw new Error(`floor_plan_version_deactivate_failed:${deactivateError.code}`)

    return { versionId: version.id }
  })
