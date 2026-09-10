import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { FloorPlanData } from '../domain/floor-plan'
import { findPlacementCollisions, isPlacementWithinBounds } from '../domain/geometry'
import { normalizeTableGroupPreset } from '../domain/table-group-presets'

const tenantInput = z.object({ tenantId: z.string().uuid() })
const venueInput = tenantInput.extend({ venueId: z.string().uuid() })
export const eventLayoutTemplateInput = venueInput.extend({
  activeFrom: z.string().datetime({ offset: true }),
  activeTo: z.string().datetime({ offset: true }).nullable().optional(),
  areaIds: z.array(z.string().uuid()).min(1).max(50),
  layout: z.record(z.unknown()),
  name: z.string().trim().min(1).max(120),
})

export const listEventLayoutTemplates = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(venueInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const { data: templates, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('event_layout_templates')
      .select('id, name, area_ids, layout, active_from, active_to')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .order('active_from', { ascending: false })
    if (error) throw new Error(`event_layout_template_list_failed:${error.code}`)
    return { templates: templates ?? [] }
  })

export const createEventLayoutTemplate = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(eventLayoutTemplateInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const activeTo = data.activeTo ?? null
    if (activeTo && new Date(activeTo).getTime() <= new Date(data.activeFrom).getTime())
      throw new Response('Invalid event interval', { status: 422 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: template, error } = await supabase
      .from('event_layout_templates')
      .insert({
        active_from: data.activeFrom,
        active_to: activeTo,
        area_ids: data.areaIds,
        created_by: context.tenantMembership.userId,
        layout: data.layout,
        name: data.name,
        tenant_id: data.tenantId,
        venue_id: data.venueId,
      })
      .select('id')
      .single()
    if (error || !template)
      throw new Error(`event_layout_template_create_failed:${error?.code ?? 'unknown'}`)
    return { templateId: template.id as string }
  })

const updateEventLayoutTemplateInput = eventLayoutTemplateInput.extend({
  templateId: z.string().uuid(),
})
const deleteEventLayoutTemplateInput = venueInput.extend({ templateId: z.string().uuid() })

export const updateEventLayoutTemplate = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(updateEventLayoutTemplateInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const activeTo = data.activeTo ?? null
    if (activeTo && new Date(activeTo).getTime() <= new Date(data.activeFrom).getTime())
      throw new Response('Invalid event interval', { status: 422 })
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('event_layout_templates')
      .update({
        active_from: data.activeFrom,
        active_to: activeTo,
        area_ids: data.areaIds,
        layout: data.layout,
        name: data.name,
      })
      .eq('id', data.templateId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (error) throw new Error(`event_layout_template_update_failed:${error.code}`)
    return { templateId: data.templateId }
  })

export const deleteEventLayoutTemplate = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(deleteEventLayoutTemplateInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('event_layout_templates')
      .delete()
      .eq('id', data.templateId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (error) throw new Error(`event_layout_template_delete_failed:${error.code}`)
    return { templateId: data.templateId }
  })
const initialFloorPlanInput = venueInput.extend({
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
    minSeats: z.number().int().min(1).max(50),
    isAccessible: z.boolean().default(false),
    rotationDeg: z.number().int().min(0).max(359).default(0),
    shape: z.enum(['square', 'rectangle', 'round', 'oval', 'custom']).default('square'),
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
  isLocked: z.boolean().optional(),
})
const planElementInput = z.object({
  heightCm: z.number().int().min(1).max(10_000),
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
  rotationDeg: z.number().int().min(0).max(359),
  widthCm: z.number().int().min(1).max(10_000),
  xCm: z.number().int().min(0).max(10_000),
  yCm: z.number().int().min(0).max(10_000),
})
const saveFloorPlanVersionInput = venueInput.extend({
  activeFrom: z.string().datetime({ offset: true }),
  activeTo: z.string().datetime({ offset: true }).nullable().optional(),
  elements: z.array(planElementInput).max(100),
  name: z.string().trim().min(1).max(100),
  placements: z.array(placementInput).max(150),
  sourceVersionId: z.string().uuid(),
})
const tableGroupPresetInput = venueInput.extend({
  areaId: z.string().uuid(),
  maxSeats: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  tableIds: z.array(z.string().uuid()).min(2).max(12),
})

function requireManager(role: string): void {
  if (role !== 'owner' && role !== 'manager') throw new Response('Forbidden', { status: 403 })
}

export const getFloorPlan = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(venueInput)
  .handler(async ({ context, data }): Promise<FloorPlanData> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const areasResult = await supabase
      .from('areas')
      .select('floor_number, id, is_online_bookable, name, outdoor_open, space_type, venue_id')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .order('name')
    if (areasResult.error) throw new Error(`floor_plan_load_failed:${areasResult.error.code}`)
    const areaIds = (areasResult.data ?? []).map((area) => area.id)

    const versionsResult = await supabase
      .from('floor_plan_versions')
      .select('active_from, active_to, area_id, height_cm, id, name, width_cm')
      .eq('tenant_id', data.tenantId)
      .in('area_id', areaIds)
      .order('active_from', { ascending: false })
    if (versionsResult.error) throw new Error(`floor_plan_load_failed:${versionsResult.error.code}`)
    const versionIds = (versionsResult.data ?? []).map((version) => version.id)

    const [
      tablesResult,
      initialPlacementsResult,
      elementsResult,
      presetsResult,
      eventTemplatesResult,
    ] = await Promise.all([
      supabase
        .from('tables')
        .select('code, id')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId),
      supabase
        .from('table_placements')
        .select(
          'floor_plan_version_id, height_cm, id, is_locked, rotation_deg, table_id, width_cm, x_cm, y_cm',
        )
        .eq('tenant_id', data.tenantId)
        .in('floor_plan_version_id', versionIds),
      supabase
        .from('plan_elements')
        .select(
          'floor_plan_version_id, height_cm, id, kind, label, rotation_deg, width_cm, x_cm, y_cm',
        )
        .eq('tenant_id', data.tenantId)
        .in('floor_plan_version_id', versionIds),
      supabase
        .from('table_group_presets')
        .select('area_id, id, max_seats, name, table_ids')
        .eq('tenant_id', data.tenantId)
        .order('name'),
      supabase
        .from('event_layout_templates')
        .select('active_from, active_to, area_ids, id, layout, name')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .order('active_from', { ascending: false }),
    ])
    const eventTemplatesUnavailable =
      eventTemplatesResult.error?.code === '42P01' || eventTemplatesResult.error?.code === '42703'
    const eventTemplates = eventTemplatesUnavailable ? [] : (eventTemplatesResult.data ?? [])
    let placementsResult = initialPlacementsResult
    if (placementsResult.error?.code === '42703') {
      const legacy = await supabase
        .from('table_placements')
        .select(
          'floor_plan_version_id, height_cm, id, rotation_deg, table_id, width_cm, x_cm, y_cm',
        )
        .eq('tenant_id', data.tenantId)
        .in('floor_plan_version_id', versionIds)
      placementsResult = {
        ...legacy,
        data: (legacy.data ?? []).map((placement) => ({ ...placement, is_locked: false })),
      } as typeof placementsResult
    }

    const error = [
      tablesResult.error,
      placementsResult.error,
      elementsResult.error,
      presetsResult.error,
      eventTemplatesUnavailable ? null : eventTemplatesResult.error,
    ].find(Boolean)
    if (error) throw new Error(`floor_plan_load_failed:${error.code}`)

    const tableCodes = new Map((tablesResult.data ?? []).map((table) => [table.id, table.code]))

    return {
      areas: (areasResult.data ?? []).map((area) => ({
        id: area.id,
        isOnlineBookable: area.is_online_bookable,
        name: area.name,
        floorNumber: area.floor_number,
        outdoorOpen: area.outdoor_open,
        spaceType: (area.space_type ?? 'indoor') as FloorPlanData['areas'][number]['spaceType'],
        venueId: area.venue_id,
      })),
      eventLayoutTemplates: eventTemplates.map((template) => ({
        activeFrom: template.active_from,
        activeTo: template.active_to,
        areaIds: template.area_ids as string[],
        id: template.id,
        layout: template.layout as never,
        name: template.name,
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
        isLocked: placement.is_locked,
        rotationDeg: placement.rotation_deg,
        widthCm: placement.width_cm,
        xCm: placement.x_cm,
        yCm: placement.y_cm,
      })),
      tableGroupPresets: (presetsResult.data ?? []).map((preset) => ({
        areaId: preset.area_id,
        id: preset.id,
        maxSeats: preset.max_seats,
        name: preset.name,
        tableIds: preset.table_ids as string[],
      })),
      versions: (versionsResult.data ?? []).map((version) => ({
        activeFrom: version.active_from,
        activeTo: version.active_to,
        areaId: version.area_id,
        heightCm: version.height_cm,
        id: version.id,
        name: version.name,
        widthCm: version.width_cm,
      })),
    }
  })

export const createTableGroupPreset = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(tableGroupPresetInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const normalized = normalizeTableGroupPreset(data)
    if (!normalized) throw new Response('Invalid table group preset', { status: 422 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: area, error: areaError } = await supabase
      .from('areas')
      .select('id')
      .eq('id', data.areaId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .single()
    if (areaError || !area) throw new Response('Not found', { status: 404 })
    const { data: preset, error } = await supabase
      .from('table_group_presets')
      .insert({
        area_id: data.areaId,
        max_seats: normalized.maxSeats,
        name: normalized.name,
        table_ids: normalized.tableIds,
        tenant_id: data.tenantId,
      })
      .select('id')
      .single()
    if (error || !preset)
      throw new Error(`table_group_preset_create_failed:${error?.code ?? 'unknown'}`)
    return { presetId: preset.id as string }
  })

const deleteTableGroupPresetInput = venueInput.extend({ presetId: z.string().uuid() })

export const deleteTableGroupPreset = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(deleteTableGroupPresetInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('table_group_presets')
      .delete()
      .eq('id', data.presetId)
      .eq('tenant_id', data.tenantId)
    if (error) throw new Error(`table_group_preset_delete_failed:${error.code}`)
    return { presetId: data.presetId }
  })

export const createInitialFloorPlan = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(initialFloorPlanInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: area, error: areaError } = await supabase
      .from('areas')
      .insert({
        floor_number: data.floorNumber,
        name: data.areaName,
        outdoor_open: data.outdoorOpen,
        space_type: data.spaceType,
        tenant_id: data.tenantId,
        venue_id: data.venueId,
      })
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
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(createTableInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: version, error: versionError } = await supabase
      .from('floor_plan_versions')
      .select('height_cm, width_cm, areas!inner(venue_id)')
      .eq('id', data.versionId)
      .eq('tenant_id', data.tenantId)
      .eq('area_id', data.areaId)
      .eq('areas.venue_id', data.venueId)
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

    const tablePayload = {
      area_id: data.areaId,
      code: data.code,
      max_seats: data.maxSeats,
      min_seats: data.minSeats,
      is_accessible: data.isAccessible,
      shape: data.shape,
      tenant_id: data.tenantId,
      venue_id: data.venueId,
    }
    let tableResult = await supabase.from('tables').insert(tablePayload).select('id').single()
    if (tableResult.error?.code === '42703') {
      const { is_accessible: _unused, ...legacyPayload } = tablePayload
      tableResult = await supabase.from('tables').insert(legacyPayload).select('id').single()
    }
    const { data: table, error: tableError } = tableResult
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
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(saveFloorPlanVersionInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: source, error: sourceError } = await supabase
      .from('floor_plan_versions')
      .select('area_id, height_cm, id, width_cm, areas!inner(venue_id)')
      .eq('id', data.sourceVersionId)
      .eq('tenant_id', data.tenantId)
      .eq('areas.venue_id', data.venueId)
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
        .eq('venue_id', data.venueId)
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
        active_to: data.activeTo ?? null,
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
              is_locked: placement.isLocked ?? false,
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
    let finalPlacementsResult = placementsResult
    if (placementsResult.error?.code === '42703') {
      const legacy = await supabase.from('table_placements').insert(
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
      )
      finalPlacementsResult = legacy
    }
    if (finalPlacementsResult.error || elementsResult.error) {
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
