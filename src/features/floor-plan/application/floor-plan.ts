import type { SupabaseClient } from '@supabase/supabase-js'
import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { FloorPlanData } from '../domain/floor-plan'
import { findPlacementCollisions, isPlacementWithinBounds } from '../domain/geometry'

const tenantInput = z.object({ tenantId: z.string().uuid() })
const venueInput = tenantInput.extend({ venueId: z.string().uuid() })
const createAreaInput = venueInput.extend({
  areaName: z.string().trim().min(1).max(100),
  heightCm: z.number().int().min(100).max(10_000),
  floorNumber: z.number().int().min(-2).max(200).nullable().default(null),
  outdoorOpen: z.boolean().default(true),
  spaceType: z.enum(['indoor', 'covered_terrace', 'outdoor_terrace', 'other']).default('indoor'),
  widthCm: z.number().int().min(100).max(10_000),
})
const createTableInput = venueInput
  .extend({
    areaId: z.string().uuid(),
    code: z.string().trim().min(1).max(20),
    heightCm: z.number().int().min(25).max(500),
    maxSeats: z.number().int().min(1).max(50),
    normalSeats: z.number().int().min(1).max(50).default(4),
    minSeats: z.number().int().min(1).max(50),
    isAccessible: z.boolean().default(false),
    shape: z.enum(['square', 'rectangle', 'round', 'oval', 'custom']).default('square'),
    tableId: z.string().uuid(),
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
  widthCm: z.number().int().min(25).max(500),
  xCm: z.number().int().min(0).max(10_000),
  yCm: z.number().int().min(0).max(10_000),
  isLocked: z.boolean().optional(),
})
const planElementInput = z.object({
  heightCm: z.number().int().min(1).max(10_000),
  id: z.string().uuid(),
  kind: z.enum([
    'wall',
    'door',
    'window',
    'bar',
    'stairs',
    'plant',
    'label',
    'other',
    'pillar',
    'bathroom',
    'kitchen',
    'exit',
    'obstacle',
  ]),
  label: z.string().trim().max(100).nullable(),
  widthCm: z.number().int().min(1).max(10_000),
  xCm: z.number().int().min(0).max(10_000),
  yCm: z.number().int().min(0).max(10_000),
})
const saveFloorPlanInput = venueInput.extend({
  areaId: z.string().uuid(),
  elements: z.array(planElementInput).max(100),
  placements: z.array(placementInput).max(150),
  widthCm: z.number().int().positive().optional(),
  heightCm: z.number().int().positive().optional(),
})
const updateTableCodeInput = venueInput.extend({
  tableId: z.string().uuid(),
  code: z.string().trim().min(1).max(20),
})
const updateAreaInput = venueInput.extend({
  areaId: z.string().uuid(),
  areaName: z.string().trim().min(1).max(100),
})
const deleteAreaInput = venueInput.extend({ areaId: z.string().uuid() })

function isMissingColumnError(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

function requireManager(role: string): void {
  if (role !== 'owner' && role !== 'manager') throw new Response('Forbidden', { status: 403 })
}

export async function loadFloorPlan(
  supabase: SupabaseClient,
  data: z.infer<typeof venueInput>,
): Promise<FloorPlanData> {
  const areasResult = await supabase
    .from('areas')
    .select(
      'floor_number, height_cm, id, is_online_bookable, name, outdoor_open, space_type, venue_id, width_cm',
    )
    .eq('tenant_id', data.tenantId)
    .eq('venue_id', data.venueId)
    .order('name')
  if (areasResult.error) throw new Error(`floor_plan_load_failed:${areasResult.error.code}`)
  const areaIds = (areasResult.data ?? []).map((area) => area.id)

  // Supabase serializes an empty `in` filter as `in.()`, which is rejected by
  // PostgREST. A venue without areas is a valid initial state for this screen.
  if (areaIds.length === 0) {
    return {
      areas: [],
      elements: [],
      placements: [],
      tableCodes: [],
    }
  }

  // The operational map only needs tables, placements and visual markers.
  // Event layouts and table presets remain legacy data but are intentionally
  // not loaded here: they are not part of the reliable day-to-day workflow.
  const [initialTablesResult, initialPlacementsResult, elementsResult] = await Promise.all([
    supabase
      .from('tables')
      .select('code, id, min_seats, normal_seats, max_seats')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId),
    supabase
      .from('table_placements')
      .select('area_id, height_cm, id, is_locked, table_id, width_cm, x_cm, y_cm')
      .eq('tenant_id', data.tenantId)
      .in('area_id', areaIds),
    supabase
      .from('plan_elements')
      .select('area_id, height_cm, id, kind, label, width_cm, x_cm, y_cm')
      .eq('tenant_id', data.tenantId)
      .in('area_id', areaIds),
  ])
  let tablesResult: typeof initialTablesResult = initialTablesResult
  if (isMissingColumnError(tablesResult.error)) {
    tablesResult = (await supabase
      .from('tables')
      .select('code, id, min_seats, max_seats')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)) as unknown as typeof tablesResult
  }
  let placementsResult = initialPlacementsResult
  if (isMissingColumnError(placementsResult.error)) {
    const legacy = await supabase
      .from('table_placements')
      .select('area_id, height_cm, id, table_id, width_cm, x_cm, y_cm')
      .eq('tenant_id', data.tenantId)
      .in('area_id', areaIds)
    placementsResult = {
      ...legacy,
      data: (legacy.data ?? []).map((placement) => ({
        ...placement,
        is_locked: false,
      })),
    } as typeof placementsResult
  }

  const error = [tablesResult.error, placementsResult.error, elementsResult.error].find(Boolean)
  if (error) throw new Error(`floor_plan_load_failed:${error.code}`)

  const tableDetails = new Map(
    (tablesResult.data ?? []).map((table) => [
      table.id,
      {
        code: table.code,
        minSeats: table.min_seats,
        normalSeats: table.normal_seats ?? Math.min(table.max_seats, Math.max(table.min_seats, 4)),
        maxSeats: table.max_seats,
      },
    ]),
  )

  return {
    areas: (areasResult.data ?? []).map((area) => ({
      heightCm: area.height_cm,
      id: area.id,
      isOnlineBookable: area.is_online_bookable,
      name: area.name,
      floorNumber: area.floor_number,
      outdoorOpen: area.outdoor_open,
      spaceType: (area.space_type ?? 'indoor') as FloorPlanData['areas'][number]['spaceType'],
      venueId: area.venue_id,
      widthCm: area.width_cm,
    })),
    elements: (elementsResult.data ?? []).map((element) => ({
      areaId: element.area_id,
      heightCm: element.height_cm,
      id: element.id,
      kind: element.kind,
      label: element.label,
      widthCm: element.width_cm,
      xCm: element.x_cm,
      yCm: element.y_cm,
    })),
    placements: (placementsResult.data ?? []).flatMap((placement) => {
      // The editor uses the table id for selection and persistence. Do not let
      // a legacy or partial record introduce an undefined identifier in UI state.
      if (typeof placement.table_id !== 'string') return []
      return [
        {
          ...(tableDetails.get(placement.table_id) ?? {
            code: '—',
            minSeats: 1,
            normalSeats: 4,
            maxSeats: 4,
          }),
          areaId: placement.area_id,
          heightCm: placement.height_cm,
          id: placement.table_id,
          isLocked: placement.is_locked,
          widthCm: placement.width_cm,
          xCm: placement.x_cm,
          yCm: placement.y_cm,
        },
      ]
    }),
    tableCodes: (tablesResult.data ?? []).map((table) => table.code),
  }
}

export const getFloorPlan = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(venueInput)
  .handler(({ context, data }) =>
    loadFloorPlan(createRequestSupabaseClient(context.tenantMembership.accessToken), data),
  )

export function floorPlanQuery(tenantId: string, venueId: string) {
  return queryOptions({
    queryFn: async () => {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('floor_plan_load_timeout')), 10_000)
      })
      return Promise.race([getFloorPlan({ data: { tenantId, venueId } }), timeout])
    },
    queryKey: ['tenant', tenantId, 'venue', venueId, 'floor-plan'],
    staleTime: 60_000,
  })
}

export const createFloorPlanArea = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(createAreaInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: existingArea, error: existingAreaError } = await supabase
      .from('areas')
      .select('id')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .eq('name', data.areaName)
      .maybeSingle()
    if (existingAreaError) throw new Error(`floor_plan_area_load_failed:${existingAreaError.code}`)
    if (existingArea) return { areaId: existingArea.id }

    const { data: area, error: areaError } = await supabase
      .from('areas')
      .insert({
        floor_number: data.floorNumber,
        height_cm: data.heightCm,
        name: data.areaName,
        outdoor_open: data.outdoorOpen,
        space_type: data.spaceType,
        tenant_id: data.tenantId,
        venue_id: data.venueId,
        width_cm: data.widthCm,
      })
      .select('id')
      .single()
    if (areaError || !area)
      throw new Error(`floor_plan_area_create_failed:${areaError?.code ?? 'unknown'}`)
    return { areaId: area.id }
  })

export const updateFloorPlanArea = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(updateAreaInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('areas')
      .update({ name: data.areaName })
      .eq('id', data.areaId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (error) {
      if (error.code === '23505') throw new Response('Area already exists', { status: 409 })
      throw new Error(`floor_plan_area_update_failed:${error.code}`)
    }
  })

export const deleteFloorPlanArea = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(deleteAreaInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [tablesResult, elementsResult] = await Promise.all([
      supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('area_id', data.areaId)
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId),
      supabase
        .from('plan_elements')
        .select('id', { count: 'exact', head: true })
        .eq('area_id', data.areaId)
        .eq('tenant_id', data.tenantId),
    ])
    if (tablesResult.error || elementsResult.error)
      throw new Error(
        `floor_plan_area_delete_check_failed:${tablesResult.error?.code ?? elementsResult.error?.code}`,
      )
    if ((tablesResult.count ?? 0) > 0 || (elementsResult.count ?? 0) > 0)
      throw new Response('Area is not empty', { status: 409 })

    const { error } = await supabase
      .from('areas')
      .delete()
      .eq('id', data.areaId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (error) throw new Error(`floor_plan_area_delete_failed:${error.code}`)
  })

export const createFloorPlanTable = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(createTableInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: area, error: areaError } = await supabase
      .from('areas')
      .select('height_cm, width_cm')
      .eq('id', data.areaId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .single()
    if (areaError || !area) throw new Response('Not found', { status: 404 })

    const { data: existing, error: placementsError } = await supabase
      .from('table_placements')
      .select('height_cm, table_id, width_cm, x_cm, y_cm')
      .eq('area_id', data.areaId)
    if (placementsError)
      throw new Error(`floor_plan_placements_load_failed:${placementsError.code}`)

    const placement = {
      heightCm: data.heightCm,
      id: 'new-table',
      widthCm: data.widthCm,
      xCm: data.xCm,
      yCm: data.yCm,
    }
    const existingPlacements = (existing ?? []).map((current) => ({
      heightCm: current.height_cm,
      id: current.table_id,
      widthCm: current.width_cm,
      xCm: current.x_cm,
      yCm: current.y_cm,
    }))
    if (
      !isPlacementWithinBounds(placement, {
        heightCm: area.height_cm,
        widthCm: area.width_cm,
      }) ||
      findPlacementCollisions(placement, existingPlacements).length > 0
    ) {
      throw new Response('Invalid placement', { status: 422 })
    }

    const tablePayload = {
      area_id: data.areaId,
      code: data.code,
      id: data.tableId,
      max_seats: data.maxSeats,
      min_seats: data.minSeats,
      normal_seats: data.normalSeats,
      is_accessible: data.isAccessible,
      shape: data.shape,
      tenant_id: data.tenantId,
      venue_id: data.venueId,
    }
    let tableResult = await supabase.from('tables').insert(tablePayload).select('id').single()
    if (tableResult.error?.code === '42703' || tableResult.error?.code === 'PGRST204') {
      const {
        is_accessible: _unusedAccessible,
        normal_seats: _unusedNormal,
        ...legacyPayload
      } = tablePayload
      tableResult = await supabase.from('tables').insert(legacyPayload).select('id').single()
    }
    const { data: table, error: tableError } = tableResult
    if (tableError || !table)
      throw new Error(`floor_plan_table_create_failed:${tableError?.code ?? 'unknown'}`)

    const { error: placementError } = await supabase.from('table_placements').insert({
      area_id: data.areaId,
      height_cm: data.heightCm,
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

export const updateFloorPlanTableCode = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(updateTableCodeInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('tables')
      .update({ code: data.code })
      .eq('id', data.tableId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (error) throw new Error(`floor_plan_table_code_update_failed:${error.code}`)
  })

/** Saves the single operational map for an area after validating its content. */
export const saveFloorPlan = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(saveFloorPlanInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: area, error: areaError } = await supabase
      .from('areas')
      .select('height_cm, id, width_cm')
      .eq('id', data.areaId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .single()
    if (areaError || !area) throw new Response('Not found', { status: 404 })

    const bounds = {
      heightCm: data.heightCm ?? area.height_cm,
      widthCm: data.widthCm ?? area.width_cm,
    }
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
    const elementIds = data.elements.map((element) => element.id)
    if (
      new Set(tableIds).size !== tableIds.length ||
      new Set(elementIds).size !== elementIds.length
    )
      throw new Response('Invalid layout', { status: 422 })
    if (tableIds.length > 0) {
      const { data: tables, error: tablesError } = await supabase
        .from('tables')
        .select('id')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .eq('area_id', area.id)
        .in('id', tableIds)
      if (tablesError || (tables?.length ?? 0) !== tableIds.length) {
        throw new Response('Invalid layout', { status: 422 })
      }
    }

    const missingPlacements = tableIds.length
      ? supabase
          .from('table_placements')
          .delete()
          .eq('area_id', area.id)
          .not('table_id', 'in', `(${tableIds.join(',')})`)
      : supabase.from('table_placements').delete().eq('area_id', area.id)
    const missingElements = elementIds.length
      ? supabase
          .from('plan_elements')
          .delete()
          .eq('area_id', area.id)
          .not('id', 'in', `(${elementIds.join(',')})`)
      : supabase.from('plan_elements').delete().eq('area_id', area.id)
    const [
      areaUpdateResult,
      placementsCleanupResult,
      elementsCleanupResult,
      placementsResult,
      elementsResult,
    ] = await Promise.all([
      supabase
        .from('areas')
        .update({ height_cm: bounds.heightCm, width_cm: bounds.widthCm })
        .eq('id', area.id)
        .eq('tenant_id', data.tenantId),
      missingPlacements,
      missingElements,
      data.placements.length === 0
        ? Promise.resolve({ error: null })
        : supabase.from('table_placements').upsert(
            data.placements.map((placement) => ({
              area_id: area.id,
              height_cm: placement.heightCm,
              is_locked: placement.isLocked ?? false,
              table_id: placement.id,
              tenant_id: data.tenantId,
              width_cm: placement.widthCm,
              x_cm: placement.xCm,
              y_cm: placement.yCm,
            })),
            { onConflict: 'area_id,table_id' },
          ),
      data.elements.length === 0
        ? Promise.resolve({ error: null })
        : supabase.from('plan_elements').upsert(
            data.elements.map((element) => ({
              area_id: area.id,
              height_cm: element.heightCm,
              id: element.id,
              kind: element.kind,
              label: element.label,
              tenant_id: data.tenantId,
              width_cm: element.widthCm,
              x_cm: element.xCm,
              y_cm: element.yCm,
            })),
          ),
    ])
    const error = [
      areaUpdateResult.error,
      placementsCleanupResult.error,
      elementsCleanupResult.error,
      placementsResult.error,
      elementsResult.error,
    ].find(Boolean)
    if (error) throw new Error(`floor_plan_save_failed:${error.code}`)

    return { areaId: area.id }
  })
