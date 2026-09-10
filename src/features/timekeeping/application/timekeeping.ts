import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { allowedNextEvent, workedMinutes, type TimeEventType } from '../domain/timekeeping'
import {
  recordTimeEventInput,
  setPinInput,
  terminalTimeEventInput,
  timekeepingInput,
  timekeepingReportInput,
  verifyPinInput,
} from './timekeeping-schema'
const middleware = [
  authMiddleware,
  tenantMembershipMiddleware,
  operationalTenantMiddleware,
] as const
export const getMyTimekeeping = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(timekeepingInput)
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: rows, error } = await supabase
      .from('timekeeping_events')
      .select('event_type, occurred_at, id')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .eq('employee_id', context.tenantMembership.userId)
      .order('occurred_at')
    if (error) throw new Error(`timekeeping_load_failed:${error.code}`)
    const events = (rows ?? []).map((row) => ({
      id: row.id as string,
      eventType: row.event_type as TimeEventType,
      occurredAt: row.occurred_at as string,
    }))
    return { events, workedMinutes: workedMinutes(events) }
  })
export const recordTimeEvent = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(recordTimeEventInput)
  .handler(async ({ context, data }) => {
    const { data: result, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    ).rpc('record_timekeeping_event', {
      p_employee_id: context.tenantMembership.userId,
      p_event_type: data.eventType,
      p_pin: null,
      p_tenant_id: data.tenantId,
      p_terminal_id: data.terminalId ?? null,
      p_venue_id: data.venueId,
    })
    if (error || !result?.[0])
      throw new Error(`timekeeping_event_failed:${error?.code ?? 'unknown'}`)
    if (result[0].result !== 'recorded')
      throw new Response('Invalid timekeeping transition', { status: 409 })
    return { eventId: result[0].event_id as string, eventType: data.eventType }
  })

export const exportTimekeepingCsv = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(timekeepingReportInput)
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: rows, error } = await supabase
      .from('timekeeping_events')
      .select('employee_id, event_type, occurred_at, terminal_id')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .gte('occurred_at', data.from)
      .lt('occurred_at', data.to)
      .order('employee_id')
      .order('occurred_at')
    if (error) throw new Error(`timekeeping_export_failed:${error.code}`)
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
    return [
      'empleado,tipo,fecha,terminal',
      ...(rows ?? []).map((row) =>
        [row.employee_id, row.event_type, row.occurred_at, row.terminal_id ?? '']
          .map((value) => escape(String(value)))
          .join(','),
      ),
    ].join('\n')
  })

export const setMyTimekeepingPin = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(setPinInput)
  .handler(async ({ context, data }) => {
    const { data: saved, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    ).rpc('set_my_timekeeping_pin', { p_pin: data.pin, p_tenant_id: data.tenantId })
    if (error || !saved) throw new Error(`timekeeping_pin_save_failed:${error?.code ?? 'unknown'}`)
    return { saved: true }
  })

export const recordTerminalTimeEvent = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(terminalTimeEventInput)
  .handler(async ({ context, data }) => {
    const { data: result, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    ).rpc('record_timekeeping_event', {
      p_employee_id: data.employeeId,
      p_event_type: data.eventType,
      p_pin: data.pin,
      p_tenant_id: data.tenantId,
      p_terminal_id: data.terminalId,
      p_venue_id: data.venueId,
    })
    if (error || !result?.[0])
      throw new Error(`terminal_timekeeping_event_failed:${error?.code ?? 'unknown'}`)
    const event = result[0]
    if (event.result === 'locked')
      throw new Response('Terminal temporarily locked', { status: 429 })
    if (event.result === 'invalid_pin' || event.result === 'invalid_employee')
      throw new Response('Invalid PIN', { status: 401 })
    if (event.result !== 'recorded')
      throw new Response('Invalid timekeeping transition', { status: 409 })
    return { eventId: event.event_id as string, eventType: data.eventType }
  })

export const getTimekeepingTerminalStaff = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(timekeepingInput)
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('id, role, user_id')
      .eq('tenant_id', data.tenantId)
      .eq('status', 'active')
      .order('created_at')
    if (membershipsError) throw new Error(`timekeeping_staff_load_failed:${membershipsError.code}`)
    const membershipIds = (memberships ?? []).map((member) => member.id)
    const userIds = (memberships ?? []).map((member) => member.user_id)
    const [profilesResult, venueAssignmentsResult] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('display_name, user_id').in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      membershipIds.length
        ? supabase
            .from('membership_venues')
            .select('membership_id, venue_id')
            .in('membership_id', membershipIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    const { data: profiles, error: profilesError } = profilesResult
    if (profilesError)
      throw new Error(`timekeeping_staff_profiles_load_failed:${profilesError.code}`)
    if (venueAssignmentsResult.error)
      throw new Error(
        `timekeeping_staff_assignments_load_failed:${venueAssignmentsResult.error.code}`,
      )
    const names = new Map(
      (profiles ?? []).map((profile) => [profile.user_id, profile.display_name]),
    )
    const assignedMembershipIds = new Set(
      (venueAssignmentsResult.data ?? []).map((assignment) => assignment.membership_id),
    )
    const venueMembershipIds = new Set(
      (venueAssignmentsResult.data ?? [])
        .filter((assignment) => assignment.venue_id === data.venueId)
        .map((assignment) => assignment.membership_id),
    )
    return (memberships ?? [])
      .filter(
        (member) => !assignedMembershipIds.has(member.id) || venueMembershipIds.has(member.id),
      )
      .map((member) => ({
        displayName: names.get(member.user_id) ?? 'Empleado',
        role: member.role as 'accountant' | 'host' | 'manager' | 'owner' | 'waiter',
        userId: member.user_id as string,
      }))
  })
