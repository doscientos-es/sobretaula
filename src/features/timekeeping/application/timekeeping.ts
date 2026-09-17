import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { isEmployeeAvailable } from '../domain/availability'
import {
  DEFAULT_TIMEKEEPING_LABOR_RULES,
  summarizeLaborTime,
  workedMinutes,
  type EmploymentType,
  type TimeEventType,
  type TimekeepingLaborRules,
} from '../domain/timekeeping'
import { hasShiftOverlap, type WorkforceShift } from '../domain/workforce'
import {
  recordTimeEventInput,
  recordOfflineTimeEventInput,
  setPinInput,
  terminalTimeEventInput,
  timekeepingHolidayInput,
  timekeepingInput,
  timekeepingRateInput,
  timekeepingReportInput,
  timekeepingTermInput,
  timekeepingVenueAssignmentInput,
  workforceShiftInput,
  workforceShiftsInput,
  workforceShiftStatusInput,
  workforceAvailabilityInput,
  workforceAbsenceInput,
  workforceAbsenceStatusInput,
} from './timekeeping-schema'
const middleware = [
  authMiddleware,
  tenantMembershipMiddleware,
  operationalTenantMiddleware,
] as const

function normalizeClock(value: string | null | undefined, fallback: `${number}:${number}`) {
  const match = value?.match(/^(\d{2}):(\d{2})/)
  return (match ? `${match[1]}:${match[2]}` : fallback) as `${number}:${number}`
}

export const getMyTimekeeping = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(timekeepingInput)
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const today = new Date().toISOString().slice(0, 10)
    const [eventsResult, termResult, holidaysResult, tenantResult] = await Promise.all([
      supabase
        .from('timekeeping_events')
        .select('event_type, occurred_at, id')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .eq('employee_id', context.tenantMembership.userId)
        .order('occurred_at'),
      supabase
        .from('timekeeping_employee_terms')
        .select(
          'daily_target_minutes, employment_type, minimum_break_minutes, minimum_daily_rest_minutes, night_ends_at, night_starts_at',
        )
        .eq('tenant_id', data.tenantId)
        .eq('employee_id', context.tenantMembership.userId)
        .lte('effective_from', today)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('timekeeping_holidays')
        .select('holiday_date')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId),
      supabase.from('tenants').select('timezone').eq('id', data.tenantId).single(),
    ])
    if (eventsResult.error) throw new Error(`timekeeping_load_failed:${eventsResult.error.code}`)
    if (termResult.error) throw new Error(`timekeeping_terms_load_failed:${termResult.error.code}`)
    if (holidaysResult.error)
      throw new Error(`timekeeping_holidays_load_failed:${holidaysResult.error.code}`)
    if (tenantResult.error)
      throw new Error(`timekeeping_timezone_load_failed:${tenantResult.error.code}`)
    const events = (eventsResult.data ?? []).map((row) => ({
      id: row.id as string,
      eventType: row.event_type as TimeEventType,
      occurredAt: row.occurred_at as string,
    }))
    const term = termResult.data
    const laborRules: TimekeepingLaborRules = term
      ? {
          dailyTargetMinutes: term.daily_target_minutes as number,
          minimumBreakMinutes: term.minimum_break_minutes as number,
          minimumDailyRestMinutes: term.minimum_daily_rest_minutes as number,
          nightEndsAt: normalizeClock(term.night_ends_at as string, '06:00'),
          nightStartsAt: normalizeClock(term.night_starts_at as string, '22:00'),
        }
      : DEFAULT_TIMEKEEPING_LABOR_RULES
    const employmentType = (term?.employment_type as EmploymentType | undefined) ?? 'full_time'
    const timeZone = (tenantResult.data?.timezone as string | null) ?? 'Europe/Madrid'
    return {
      events,
      laborContext: { employmentType, rules: laborRules, timeZone },
      laborSummary: summarizeLaborTime({
        employmentType,
        events,
        holidayDates: (holidaysResult.data ?? []).map((holiday) => holiday.holiday_date as string),
        rules: laborRules,
        timeZone,
      }),
      workedMinutes: workedMinutes(events),
    }
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

export const recordOfflineTimeEvent = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(recordOfflineTimeEventInput)
  .handler(async ({ context, data }) => {
    if (data.employeeId !== context.tenantMembership.userId)
      throw new Response('Forbidden', { status: 403 })
    const { data: result, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    ).rpc('record_timekeeping_event_offline', {
      p_client_occurred_at: data.clientOccurredAt,
      p_event_type: data.eventType,
      p_operation_id: data.operationId,
      p_tenant_id: data.tenantId,
      p_venue_id: data.venueId,
    })
    if (error || !result?.[0])
      throw new Error(`offline_timekeeping_event_failed:${error?.code ?? 'unknown'}`)
    return {
      eventId: (result[0].event_id as string | null) ?? null,
      eventType: data.eventType,
      result: result[0].result as string,
    }
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

function requireTimekeepingManager(role: string): void {
  if (role !== 'owner' && role !== 'manager') throw new Response('Forbidden', { status: 403 })
}

export const getTimekeepingConfiguration = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(timekeepingInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [
      membersResult,
      profilesResult,
      termsResult,
      holidaysResult,
      assignmentsResult,
      venuesResult,
      ratesResult,
      shiftsResult,
    ] = await Promise.all([
      supabase
        .from('memberships')
        .select('id, user_id, role')
        .eq('tenant_id', data.tenantId)
        .eq('status', 'active')
        .order('created_at'),
      supabase.from('profiles').select('user_id, display_name'),
      supabase
        .from('timekeeping_employee_terms')
        .select(
          'daily_target_minutes, effective_from, employee_id, employment_type, minimum_break_minutes, minimum_daily_rest_minutes, night_ends_at, night_starts_at',
        )
        .eq('tenant_id', data.tenantId)
        .order('effective_from', { ascending: false }),
      supabase
        .from('timekeeping_holidays')
        .select('holiday_date, label')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .order('holiday_date'),
      supabase.from('membership_venues').select('membership_id, venue_id'),
      supabase
        .from('venues')
        .select('id, name')
        .eq('tenant_id', data.tenantId)
        .eq('is_active', true),
      supabase
        .from('timekeeping_employee_rates')
        .select('employee_id, effective_from, hourly_cost_cents')
        .eq('tenant_id', data.tenantId)
        .order('effective_from', { ascending: false }),
      supabase
        .from('workforce_shifts')
        .select('id, employee_id, starts_at, ends_at, status, note')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .gte('ends_at', new Date().toISOString())
        .order('starts_at'),
    ])
    if (
      membersResult.error ||
      profilesResult.error ||
      termsResult.error ||
      holidaysResult.error ||
      assignmentsResult.error ||
      venuesResult.error ||
      (ratesResult.error && ratesResult.error.code !== '42P01') ||
      (shiftsResult.error && shiftsResult.error.code !== '42P01')
    )
      throw new Error('timekeeping_configuration_load_failed')
    const names = new Map(
      (profilesResult.data ?? []).map((profile) => [profile.user_id, profile.display_name]),
    )
    return {
      employees: (membersResult.data ?? []).map((member) => ({
        displayName: names.get(member.user_id) ?? 'Empleado',
        role: member.role as string,
        userId: member.user_id as string,
      })),
      holidays: (holidaysResult.data ?? []).map((holiday) => ({
        date: holiday.holiday_date as string,
        label: holiday.label as string,
      })),
      assignments: (membersResult.data ?? []).map((member) => ({
        employeeId: member.user_id as string,
        venueIds: (assignmentsResult.data ?? [])
          .filter((assignment) => assignment.membership_id === member.id)
          .map((assignment) => assignment.venue_id as string),
      })),
      venues: (venuesResult.data ?? []).map((venue) => ({
        id: venue.id as string,
        name: venue.name as string,
      })),
      terms: (termsResult.data ?? []).map((term) => ({
        dailyTargetMinutes: term.daily_target_minutes as number,
        effectiveFrom: term.effective_from as string,
        employeeId: term.employee_id as string,
        employmentType: term.employment_type as 'full_time' | 'part_time',
        minimumBreakMinutes: term.minimum_break_minutes as number,
        minimumDailyRestMinutes: term.minimum_daily_rest_minutes as number,
        nightEndsAt: normalizeClock(term.night_ends_at as string, '06:00'),
        nightStartsAt: normalizeClock(term.night_starts_at as string, '22:00'),
      })),
      shifts:
        shiftsResult.error?.code === '42P01'
          ? []
          : (shiftsResult.data ?? []).map((shift) => ({
              id: shift.id as string,
              employeeId: shift.employee_id as string,
              startsAt: shift.starts_at as string,
              endsAt: shift.ends_at as string,
              status: shift.status as 'draft' | 'published' | 'confirmed' | 'cancelled',
              note: shift.note as string | null,
            })),
      rates:
        ratesResult.error?.code === '42P01'
          ? []
          : (ratesResult.data ?? []).map((rate) => ({
              effectiveFrom: rate.effective_from as string,
              employeeId: rate.employee_id as string,
              hourlyCostCents: rate.hourly_cost_cents as number,
            })),
    }
  })

export interface TimekeepingAdvancedReport {
  from: string
  rows: Array<{
    breakViolationCount: number
    complementaryMinutes: number
    days: ReturnType<typeof summarizeLaborTime>['days']
    displayName: string
    employeeId: string
    holidayMinutes: number
    nightMinutes: number
    overtimeMinutes: number
    restViolationCount: number
    role: string
    splitShiftDays: number
    workedMinutes: number
  }>
  to: string
  totalWorkedMinutes: number
  venueId: string
}

export const getTimekeepingAdvancedReport = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(timekeepingReportInput)
  .handler(async ({ context, data }): Promise<TimekeepingAdvancedReport> => {
    requireTimekeepingManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [membersResult, profilesResult, eventsResult, termsResult, holidaysResult, tenantResult] =
      await Promise.all([
        supabase
          .from('memberships')
          .select('user_id, role')
          .eq('tenant_id', data.tenantId)
          .eq('status', 'active'),
        supabase.from('profiles').select('user_id, display_name'),
        supabase
          .from('timekeeping_events')
          .select('employee_id, event_type, occurred_at, client_occurred_at')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .gte('occurred_at', data.from)
          .lt('occurred_at', data.to)
          .order('occurred_at'),
        supabase
          .from('timekeeping_employee_terms')
          .select(
            'daily_target_minutes, effective_from, employee_id, employment_type, minimum_break_minutes, minimum_daily_rest_minutes, night_ends_at, night_starts_at',
          )
          .eq('tenant_id', data.tenantId)
          .lte('effective_from', data.to.slice(0, 10))
          .order('effective_from', { ascending: false }),
        supabase
          .from('timekeeping_holidays')
          .select('holiday_date')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId),
        supabase.from('tenants').select('timezone').eq('id', data.tenantId).single(),
      ])
    if (
      membersResult.error ||
      profilesResult.error ||
      eventsResult.error ||
      termsResult.error ||
      holidaysResult.error ||
      tenantResult.error
    )
      throw new Error('timekeeping_advanced_report_failed')
    const names = new Map(
      (profilesResult.data ?? []).map((profile) => [profile.user_id, profile.display_name]),
    )
    const eventsByEmployee = new Map<
      string,
      Array<{ eventType: TimeEventType; occurredAt: string }>
    >()
    for (const event of eventsResult.data ?? []) {
      const occurredAt = (event.client_occurred_at ?? event.occurred_at) as string
      const current = eventsByEmployee.get(event.employee_id as string) ?? []
      current.push({ eventType: event.event_type as TimeEventType, occurredAt })
      eventsByEmployee.set(event.employee_id as string, current)
    }
    const timeZone = (tenantResult.data?.timezone as string | null) ?? 'Europe/Madrid'
    const holidayDates = (holidaysResult.data ?? []).map(
      (holiday) => holiday.holiday_date as string,
    )
    const rows = (membersResult.data ?? []).map((member) => {
      const term = (termsResult.data ?? []).find(
        (candidate) => candidate.employee_id === member.user_id,
      )
      const rules: TimekeepingLaborRules = term
        ? {
            dailyTargetMinutes: term.daily_target_minutes as number,
            minimumBreakMinutes: term.minimum_break_minutes as number,
            minimumDailyRestMinutes: term.minimum_daily_rest_minutes as number,
            nightEndsAt: normalizeClock(term.night_ends_at as string, '06:00'),
            nightStartsAt: normalizeClock(term.night_starts_at as string, '22:00'),
          }
        : DEFAULT_TIMEKEEPING_LABOR_RULES
      const summary = summarizeLaborTime({
        employmentType: (term?.employment_type as EmploymentType | undefined) ?? 'full_time',
        events: eventsByEmployee.get(member.user_id as string) ?? [],
        holidayDates,
        now: new Date(data.to),
        rules,
        timeZone,
      })
      return {
        ...summary,
        displayName: names.get(member.user_id) ?? 'Empleado',
        employeeId: member.user_id as string,
        role: member.role as string,
      }
    })
    return {
      from: data.from,
      rows,
      to: data.to,
      totalWorkedMinutes: rows.reduce((total, row) => total + row.workedMinutes, 0),
      venueId: data.venueId,
    }
  })

export const saveTimekeepingTerm = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(timekeepingTermInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('timekeeping_employee_terms')
      .upsert({
        created_by: context.tenantMembership.userId,
        daily_target_minutes: data.dailyTargetMinutes,
        effective_from: data.effectiveFrom,
        employee_id: data.employeeId,
        employment_type: data.employmentType,
        minimum_break_minutes: data.minimumBreakMinutes,
        minimum_daily_rest_minutes: data.minimumDailyRestMinutes,
        night_ends_at: data.nightEndsAt,
        night_starts_at: data.nightStartsAt,
        tenant_id: data.tenantId,
      })
    if (error) throw new Error(`timekeeping_term_save_failed:${error.code}`)
    return { saved: true }
  })

export const saveTimekeepingRate = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(timekeepingRateInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('timekeeping_employee_rates')
      .upsert({
        created_by: context.tenantMembership.userId,
        effective_from: data.effectiveFrom,
        employee_id: data.employeeId,
        hourly_cost_cents: data.hourlyCostCents,
        tenant_id: data.tenantId,
      })
    if (error) throw new Error(`timekeeping_rate_save_failed:${error.code}`)
    return { saved: true }
  })

export const createWorkforceShift = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(workforceShiftInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const existing = await supabase
      .from('workforce_shifts')
      .select('employee_id, starts_at, ends_at, status')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .neq('status', 'cancelled')
      .lt('starts_at', data.endsAt)
      .gt('ends_at', data.startsAt)
    if (existing.error) throw new Error(`workforce_shift_check_failed:${existing.error.code}`)
    const candidate = {
      employeeId: data.employeeId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      status: 'draft' as const,
    }
    const shifts = (existing.data ?? []).map((shift) => ({
      employeeId: shift.employee_id as string,
      startsAt: shift.starts_at as string,
      endsAt: shift.ends_at as string,
      status: shift.status as WorkforceShift['status'],
    }))
    if (hasShiftOverlap(shifts, candidate)) throw new Error('workforce_shift_overlap')
    const { error } = await supabase.from('workforce_shifts').insert({
      tenant_id: data.tenantId,
      venue_id: data.venueId,
      employee_id: data.employeeId,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      note: data.note ?? null,
      created_by: context.tenantMembership.userId,
    })
    if (error) throw new Error(`workforce_shift_create_failed:${error.code}`)
    return { saved: true }
  })

export const createWorkforceShifts = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(workforceShiftsInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const periods = data.shifts.map((shift) => ({
      employeeId: data.employeeId,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      status: 'draft' as const,
    }))
    if (
      periods.some(
        (shift) =>
          !Number.isFinite(new Date(shift.startsAt).getTime()) ||
          !Number.isFinite(new Date(shift.endsAt).getTime()) ||
          new Date(shift.endsAt) <= new Date(shift.startsAt),
      )
    )
      throw new Response('Invalid period', { status: 422 })

    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const earliestStart = periods.reduce(
      (earliest, shift) => (shift.startsAt < earliest ? shift.startsAt : earliest),
      periods[0]?.startsAt ?? '',
    )
    const latestEnd = periods.reduce(
      (latest, shift) => (shift.endsAt > latest ? shift.endsAt : latest),
      periods[0]?.endsAt ?? '',
    )
    const existing = await supabase
      .from('workforce_shifts')
      .select('employee_id, starts_at, ends_at, status')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .neq('status', 'cancelled')
      .lt('starts_at', latestEnd)
      .gt('ends_at', earliestStart)
    if (existing.error) throw new Error(`workforce_shift_check_failed:${existing.error.code}`)
    const existingShifts = (existing.data ?? []).map((shift) => ({
      employeeId: shift.employee_id as string,
      startsAt: shift.starts_at as string,
      endsAt: shift.ends_at as string,
      status: shift.status as WorkforceShift['status'],
    }))
    for (const [index, period] of periods.entries()) {
      if (
        hasShiftOverlap(existingShifts, period) ||
        hasShiftOverlap(periods.slice(0, index), period)
      )
        throw new Error('workforce_shift_overlap')
    }
    const { error } = await supabase.from('workforce_shifts').insert(
      data.shifts.map((shift) => ({
        tenant_id: data.tenantId,
        venue_id: data.venueId,
        employee_id: data.employeeId,
        starts_at: shift.startsAt,
        ends_at: shift.endsAt,
        note: shift.note ?? null,
        created_by: context.tenantMembership.userId,
      })),
    )
    if (error) throw new Error(`workforce_shift_create_failed:${error.code}`)
    return { saved: true, count: periods.length }
  })

export const updateWorkforceShiftStatus = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(workforceShiftStatusInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    if (data.status === 'published') {
      const [shiftResult, windowsResult, absencesResult] = await Promise.all([
        supabase
          .from('workforce_shifts')
          .select('employee_id, starts_at, ends_at, status')
          .eq('id', data.shiftId)
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .single(),
        supabase
          .from('workforce_availability')
          .select('employee_id, weekday, starts_at, ends_at, available')
          .eq('tenant_id', data.tenantId),
        supabase
          .from('workforce_absences')
          .select('employee_id, starts_at, ends_at, status')
          .eq('tenant_id', data.tenantId)
          .eq('status', 'approved'),
      ])
      if (shiftResult.error)
        throw new Error(`workforce_shift_load_failed:${shiftResult.error.code}`)
      if (
        (windowsResult.error && windowsResult.error.code !== '42P01') ||
        (absencesResult.error && absencesResult.error.code !== '42P01')
      )
        throw new Error('workforce_availability_load_failed')
      const employeeId = shiftResult.data.employee_id as string
      const windows = (windowsResult.data ?? [])
        .filter((window) => window.employee_id === employeeId)
        .map((window) => ({
          weekday: window.weekday as number,
          startsAt: String(window.starts_at).slice(0, 5),
          endsAt: String(window.ends_at).slice(0, 5),
          available: window.available as boolean,
        }))
      const absences = (absencesResult.data ?? [])
        .filter((absence) => absence.employee_id === employeeId)
        .map((absence) => ({
          startsAt: absence.starts_at as string,
          endsAt: absence.ends_at as string,
          status: 'approved' as const,
        }))
      if (
        windows.length > 0 &&
        !isEmployeeAvailable(
          {
            employeeId,
            startsAt: shiftResult.data.starts_at as string,
            endsAt: shiftResult.data.ends_at as string,
            status: 'draft',
          },
          windows,
          absences,
        )
      )
        throw new Error('workforce_shift_outside_availability')
    }
    const { error } = await supabase
      .from('workforce_shifts')
      .update({ status: data.status })
      .eq('id', data.shiftId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (error) throw new Error(`workforce_shift_status_failed:${error.code}`)
    return { saved: true }
  })

export const saveWorkforceAvailability = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(workforceAvailabilityInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('workforce_availability')
      .upsert({
        tenant_id: data.tenantId,
        employee_id: data.employeeId,
        weekday: data.weekday,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        available: data.available,
      })
    if (error) throw new Error(`workforce_availability_save_failed:${error.code}`)
    return { saved: true }
  })

export const createWorkforceAbsence = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(workforceAbsenceInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('workforce_absences')
      .insert({
        tenant_id: data.tenantId,
        employee_id: data.employeeId,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        reason: data.reason,
        created_by: context.tenantMembership.userId,
      })
    if (error) throw new Error(`workforce_absence_create_failed:${error.code}`)
    return { saved: true }
  })

export const updateWorkforceAbsenceStatus = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(workforceAbsenceStatusInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('workforce_absences')
      .update({ status: data.status })
      .eq('id', data.absenceId)
      .eq('tenant_id', data.tenantId)
    if (error) throw new Error(`workforce_absence_status_failed:${error.code}`)
    return { saved: true }
  })

export const saveTimekeepingHoliday = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(timekeepingHolidayInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('timekeeping_holidays')
      .upsert({
        created_by: context.tenantMembership.userId,
        holiday_date: data.holidayDate,
        label: data.label,
        tenant_id: data.tenantId,
        venue_id: data.venueId,
      })
    if (error) throw new Error(`timekeeping_holiday_save_failed:${error.code}`)
    return { saved: true }
  })

export const saveTimekeepingVenueAssignments = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(timekeepingVenueAssignmentInput)
  .handler(async ({ context, data }) => {
    requireTimekeepingManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).rpc(
      'set_timekeeping_employee_venues',
      {
        p_effective_from: data.effectiveFrom,
        p_employee_id: data.employeeId,
        p_tenant_id: data.tenantId,
        p_venue_ids: data.venueIds,
      },
    )
    if (error) throw new Error(`timekeeping_venue_assignment_save_failed:${error.code}`)
    return { saved: true }
  })
