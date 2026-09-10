import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildServiceTableStates,
  SERVICE_SHIFT_WINDOW_MINUTES,
  type ServiceBoard,
  type ServiceReservation,
  type ServiceSession,
  type ServiceStaffMember,
  type ServiceHandoverSnapshot,
  type ServiceTable,
  type WaitlistEntry,
} from '../../domain/service-board'

export interface ServiceBoardQuery {
  now: Date
  tenantId: string
  venueId: string
}

/**
 * Single read of everything the room shows right now. The mutations reuse it so
 * a move or a merge is validated against the same picture the host sees.
 */
export async function loadServiceBoard(
  supabase: SupabaseClient,
  { now, tenantId, venueId }: ServiceBoardQuery,
): Promise<ServiceBoard> {
  const windowStart = new Date(now.getTime() - SERVICE_SHIFT_WINDOW_MINUTES * 60_000)
  const windowEnd = new Date(now.getTime() + SERVICE_SHIFT_WINDOW_MINUTES * 60_000)

  const [initialTablesResult, sessionsResult, reservationsResult, waitlistResult] =
    await Promise.all([
      supabase
        .from('tables')
        .select(
          'area_id, code, id, is_accessible, is_pending_cleaning, is_service_blocked, max_seats, min_seats, service_block_reason',
        )
        .eq('tenant_id', tenantId)
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('code'),
      supabase
        .from('table_sessions')
        .select('covers, id, internal_note, opened_at, reservation_id, table_ids')
        .eq('tenant_id', tenantId)
        .eq('venue_id', venueId)
        .eq('status', 'open')
        .order('opened_at'),
      supabase
        .from('reservations')
        .select('guest_id, id, party_size, starts_at')
        .eq('tenant_id', tenantId)
        .eq('venue_id', venueId)
        .in('status', ['pending', 'confirmed'])
        .gte('starts_at', windowStart.toISOString())
        .lte('starts_at', windowEnd.toISOString())
        .order('starts_at'),
      supabase
        .from('waitlist')
        .select('estimated_wait_minutes, guest_id, id, party_size, requested_for')
        .eq('tenant_id', tenantId)
        .eq('venue_id', venueId)
        .order('created_at'),
    ])
  let tablesResult = initialTablesResult

  if (tablesResult.error?.code === '42703') {
    const legacyTablesResult = await supabase
      .from('tables')
      .select(
        'area_id, code, id, is_pending_cleaning, is_service_blocked, max_seats, min_seats, service_block_reason',
      )
      .eq('tenant_id', tenantId)
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('code')
    tablesResult = {
      ...legacyTablesResult,
      data: (legacyTablesResult.data ?? []).map((table) => ({ ...table, is_accessible: false })),
    } as typeof tablesResult
  }

  const error = [
    tablesResult.error,
    sessionsResult.error,
    reservationsResult.error,
    waitlistResult.error,
  ].find(Boolean)
  if (error) throw new Error(`service_board_load_failed:${error.code}`)

  const snapshotsResult = await supabase
    .from('service_handover_snapshots')
    .select('created_at, created_by, id, summary')
    .eq('tenant_id', tenantId)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (snapshotsResult.error && snapshotsResult.error.code !== '42P01')
    throw new Error(`service_handover_snapshots_load_failed:${snapshotsResult.error.code}`)
  const snapshotCreatorIds = (snapshotsResult.data ?? []).map((snapshot) => snapshot.created_by)
  const pacingResult = await supabase
    .from('venues')
    .select(
      'service_kitchen_alert_minutes, service_kitchen_alert_order_count, service_pacing_target_minutes',
    )
    .eq('id', venueId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (pacingResult.error && pacingResult.error.code !== '42703')
    throw new Error(`service_pacing_config_load_failed:${pacingResult.error.code}`)
  const recentOrderSince = new Date(now.getTime() - 30 * 60_000).toISOString()
  const openSessionIds = (sessionsResult.data ?? []).map((session) => session.id)
  const recentOrdersResult = openSessionIds.length
    ? await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('session_id', openSessionIds)
        .gte('created_at', recentOrderSince)
    : { data: [], error: null }
  if (recentOrdersResult.error)
    throw new Error(`service_kitchen_load_failed:${recentOrdersResult.error.code}`)
  const recentOrderCount = recentOrdersResult.data?.length ?? 0
  const recentOrderIds = (recentOrdersResult.data ?? []).map((order) => order.id as string)
  let kitchenItemsResult = recentOrderIds.length
    ? await supabase
        .from('order_items')
        .select('kitchen_station, preparation_minutes, quantity')
        .eq('tenant_id', tenantId)
        .in('order_id', recentOrderIds)
    : { data: [], error: null }
  if (kitchenItemsResult.error?.code === '42703' && recentOrderIds.length > 0) {
    const legacy = await supabase
      .from('order_items')
      .select('quantity')
      .eq('tenant_id', tenantId)
      .in('order_id', recentOrderIds)
    kitchenItemsResult = {
      ...legacy,
      data: (legacy.data ?? []).map((item) => ({
        ...item,
        kitchen_station: 'general',
        preparation_minutes: 15,
      })),
    } as typeof kitchenItemsResult
  }
  if (kitchenItemsResult.error)
    throw new Error(`service_kitchen_station_load_failed:${kitchenItemsResult.error.code}`)
  const kitchenLoadByStation: Record<string, number> = {}
  for (const item of kitchenItemsResult.data ?? []) {
    const station = (item.kitchen_station as string | null) ?? 'general'
    kitchenLoadByStation[station] =
      (kitchenLoadByStation[station] ?? 0) +
      (item.quantity as number) * ((item.preparation_minutes as number | null) ?? 15)
  }
  const snapshotProfilesResult = snapshotCreatorIds.length
    ? await supabase
        .from('profiles')
        .select('display_name, user_id')
        .in('user_id', [...new Set(snapshotCreatorIds)])
    : { data: [], error: null }
  if (snapshotProfilesResult.error)
    throw new Error(
      `service_handover_snapshot_profiles_failed:${snapshotProfilesResult.error.code}`,
    )
  const snapshotCreatorNames = new Map<string, string>(
    (snapshotProfilesResult.data ?? []).map((profile) => [
      profile.user_id as string,
      profile.display_name as string,
    ]),
  )

  const areaIds = [...new Set((tablesResult.data ?? []).map((table) => table.area_id))]
  const presetsResult = areaIds.length
    ? await supabase
        .from('table_group_presets')
        .select('id, max_seats, name, table_ids')
        .eq('tenant_id', tenantId)
        .in('area_id', areaIds)
        .order('name')
    : { data: [], error: null }
  if (presetsResult.error)
    throw new Error(`service_board_presets_load_failed:${presetsResult.error.code}`)

  const [areaAssignmentsResult, membersResult] = await Promise.all([
    areaIds.length
      ? supabase
          .from('area_staff_assignments')
          .select('area_id, user_id')
          .eq('tenant_id', tenantId)
          .in('area_id', areaIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('memberships')
      .select('role, status, user_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('role', ['owner', 'manager', 'host', 'waiter']),
  ])
  if (
    (areaAssignmentsResult.error && areaAssignmentsResult.error.code !== '42P01') ||
    membersResult.error
  )
    throw new Error('service_board_staff_load_failed')
  const memberIds = (membersResult.data ?? []).map((member) => member.user_id)
  const profilesResult = memberIds.length
    ? await supabase.from('profiles').select('display_name, user_id').in('user_id', memberIds)
    : { data: [], error: null }
  if (profilesResult.error) throw new Error('service_board_staff_profiles_failed')
  const profileNames = new Map<string, string>(
    (profilesResult.data ?? []).map((profile) => [
      profile.user_id as string,
      profile.display_name as string,
    ]),
  )
  const staff: ServiceStaffMember[] = (membersResult.data ?? []).map((member) => ({
    displayName: profileNames.get(member.user_id) ?? 'Equipo',
    role: member.role as ServiceStaffMember['role'],
    userId: member.user_id as string,
  }))
  const areaStaffAssignments: Record<string, string[]> = {}
  for (const assignment of areaAssignmentsResult.error ? [] : (areaAssignmentsResult.data ?? [])) {
    areaStaffAssignments[assignment.area_id] = [
      ...(areaStaffAssignments[assignment.area_id] ?? []),
      assignment.user_id,
    ]
  }

  const reservationIds = (reservationsResult.data ?? []).map((reservation) => reservation.id)
  const guestIds = [
    ...(reservationsResult.data ?? []).map((reservation) => reservation.guest_id),
    ...(waitlistResult.data ?? []).map((entry) => entry.guest_id),
  ].filter((guestId): guestId is string => typeof guestId === 'string')

  const [assignmentsResult, guestsResult, guestNotesResult] = await Promise.all([
    reservationIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('reservation_tables')
          .select('reservation_id, table_id')
          .eq('tenant_id', tenantId)
          .in('reservation_id', reservationIds),
    guestIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('guests')
          .select('full_name, id, phone')
          .eq('tenant_id', tenantId)
          .in('id', [...new Set(guestIds)]),
    guestIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('guest_notes')
          .select('body, category, guest_id')
          .eq('tenant_id', tenantId)
          .in('guest_id', [...new Set(guestIds)])
          .eq('category', 'preference'),
  ])
  if (assignmentsResult.error || guestsResult.error || guestNotesResult.error)
    throw new Error('service_board_load_failed')

  const assignedTables = new Map<string, string[]>()
  for (const assignment of assignmentsResult.data ?? []) {
    const current = assignedTables.get(assignment.reservation_id) ?? []
    assignedTables.set(assignment.reservation_id, [...current, assignment.table_id])
  }
  const guestNames = new Map<string, string>(
    (guestsResult.data ?? []).map((guest) => [guest.id as string, guest.full_name as string]),
  )
  const guestPhones = new Map<string, string | null>(
    (guestsResult.data ?? []).map((guest) => [
      guest.id as string,
      (guest.phone as string | null) ?? null,
    ]),
  )
  const guestPreferences = new Map<string, string[]>()
  for (const note of guestNotesResult.data ?? []) {
    const body = typeof note.body === 'string' ? note.body.trim() : ''
    if (!body) continue
    guestPreferences.set(note.guest_id as string, [
      ...(guestPreferences.get(note.guest_id as string) ?? []),
      body,
    ])
  }

  const tables: ServiceTable[] = (tablesResult.data ?? []).map((table) => ({
    areaId: table.area_id,
    blockReason: table.service_block_reason,
    code: table.code,
    id: table.id,
    isBlocked: table.is_service_blocked,
    isAccessible: table.is_accessible,
    isPendingCleaning: table.is_pending_cleaning,
    maxSeats: table.max_seats,
    minSeats: table.min_seats,
  }))
  const sessions: ServiceSession[] = (sessionsResult.data ?? []).map((session) => ({
    covers: session.covers,
    id: session.id,
    internalNote: session.internal_note,
    openedAt: session.opened_at,
    reservationId: session.reservation_id,
    tableIds: session.table_ids,
  }))
  const reservations: ServiceReservation[] = (reservationsResult.data ?? []).map((reservation) => {
    const base: ServiceReservation = {
      guestName: reservation.guest_id ? (guestNames.get(reservation.guest_id) ?? null) : null,
      guestPhone: reservation.guest_id ? (guestPhones.get(reservation.guest_id) ?? null) : null,
      id: reservation.id,
      partySize: reservation.party_size,
      startsAt: reservation.starts_at,
      tableIds: assignedTables.get(reservation.id) ?? [],
    }
    const preferences = reservation.guest_id
      ? guestPreferences.get(reservation.guest_id)
      : undefined
    return preferences ? { ...base, preferences } : base
  })
  const waitlist: WaitlistEntry[] = (waitlistResult.data ?? []).map((entry) => ({
    estimatedWaitMinutes: entry.estimated_wait_minutes,
    guestName: entry.guest_id ? (guestNames.get(entry.guest_id) ?? null) : null,
    guestPhone: entry.guest_id ? (guestPhones.get(entry.guest_id) ?? null) : null,
    id: entry.id,
    partySize: entry.party_size,
    requestedFor: entry.requested_for,
  }))

  return {
    areaStaffAssignments,
    reservations,
    handoverSnapshots: (snapshotsResult.error ? [] : (snapshotsResult.data ?? [])).map(
      (snapshot): ServiceHandoverSnapshot => {
        const createdByName = snapshotCreatorNames.get(snapshot.created_by as string)
        const base = {
          createdAt: snapshot.created_at as string,
          createdBy: snapshot.created_by as string,
          id: snapshot.id as string,
          summary: snapshot.summary as ServiceHandoverSnapshot['summary'],
        }
        return createdByName ? { ...base, createdByName } : base
      },
    ),
    sessions,
    pacingTargetMinutes: pacingResult.data?.service_pacing_target_minutes ?? 90,
    kitchenAlertOrderCount: pacingResult.data?.service_kitchen_alert_order_count ?? 12,
    kitchenAlertMinutes: pacingResult.data?.service_kitchen_alert_minutes ?? 60,
    kitchenLoad: recentOrderCount,
    kitchenLoadByStation,
    tables: buildServiceTableStates({
      now,
      reservations,
      sessions,
      tables,
      windowMinutes: SERVICE_SHIFT_WINDOW_MINUTES,
    }),
    tableGroupPresets: (presetsResult.data ?? []).map((preset) => ({
      id: preset.id,
      maxSeats: preset.max_seats,
      name: preset.name,
      tableIds: preset.table_ids as string[],
    })),
    staff,
    waitlist,
  }
}
