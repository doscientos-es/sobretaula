import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { workedMinutes, type TimeEvent } from '@/features/timekeeping/domain/timekeeping'
import { paginationRange } from '@/shared/lib/pagination'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { distributeTips } from '../domain/tips'
import { closeTipsInput, saveTipInput, tipsInput } from './tips-schema'
const middleware = [
  authMiddleware,
  tenantMembershipMiddleware,
  operationalTenantMiddleware,
] as const
function manager(role: string) {
  if (!['owner', 'manager'].includes(role)) throw new Response('Forbidden', { status: 403 })
}
export const getTipsOverview = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(tipsInput)
  .handler(async ({ context, data }) => {
    manager(context.tenantMembership.role)
    const db = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [entries, periods, auditEvents] = await Promise.all([
      db
        .from('tip_pool_entries')
        .select('id, tip_date, amount_cents, note, created_by, created_at', { count: 'exact' })
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .order('tip_date', { ascending: false })
        .range(...(Object.values(paginationRange(data)) as [number, number])),
      db
        .from('tip_pool_periods')
        .select('id, from_date, to_date, total_cents, closed_at, closed_by')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .order('closed_at', { ascending: false })
        .limit(12),
      db
        .from('tip_pool_audit_events')
        .select(
          'id, event_type, tip_date, from_date, to_date, total_cents, note, actor_display_name, occurred_at',
        )
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .order('occurred_at', { ascending: false })
        .limit(100),
    ])
    if (entries.error || periods.error || auditEvents.error) throw new Error('tips_load_failed')
    const entryRows = entries.data ?? []
    const periodRows = (periods.data ?? []) as Array<{
      id: string
      from_date: string
      to_date: string
      total_cents: number
      closed_at: string | null
      closed_by: string | null
    }>
    const userIds = Array.from(
      new Set(
        [
          ...entryRows.map((entry) => entry.created_by),
          ...periodRows.map((period) => period.closed_by),
        ].filter((userId): userId is string => typeof userId === 'string'),
      ),
    )
    const profilesResult = userIds.length
      ? await db.from('profiles').select('user_id, display_name').in('user_id', userIds)
      : { data: [], error: null }
    if (profilesResult.error) throw new Error('tips_profiles_load_failed')
    const userNames = new Map(
      (profilesResult.data ?? []).map((profile) => [profile.user_id, profile.display_name]),
    )
    const openEntries = entryRows.filter(
      (entry) =>
        !periodRows.some(
          (period) => entry.tip_date >= period.from_date && entry.tip_date <= period.to_date,
        ),
    )
    return {
      auditEvents: auditEvents.data ?? [],
      entries: entryRows.map((entry) => ({
        ...entry,
        recordedBy: userNames.get(entry.created_by) ?? 'Usuario sin perfil',
      })),
      periods: periodRows.map((period) => ({
        ...period,
        closedBy: userNames.get(period.closed_by) ?? 'Usuario sin perfil',
      })),
      balanceCents: openEntries.reduce((sum, row) => sum + Number(row.amount_cents), 0),
      entriesPage: data.page,
      entriesPageSize: data.pageSize,
      entriesTotal: entries.count ?? entryRows.length,
      entriesHasMore: data.page * data.pageSize < (entries.count ?? entryRows.length),
    }
  })
export const saveTipEntry = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(saveTipInput)
  .handler(async ({ context, data }) => {
    manager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('tip_pool_entries')
      .upsert(
        {
          tenant_id: data.tenantId,
          venue_id: data.venueId,
          tip_date: data.date,
          amount_cents: data.amountCents,
          note: data.note || null,
          created_by: context.tenantMembership.userId,
        },
        { onConflict: 'tenant_id,venue_id,tip_date' },
      )
    if (error) throw new Error(`tips_save_failed:${error.code}`)
    return { saved: true }
  })
export const closeTipsPeriod = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(closeTipsInput)
  .handler(async ({ context, data }) => {
    manager(context.tenantMembership.role)
    const db = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [entries, periods, members, profiles, events] = await Promise.all([
      db
        .from('tip_pool_entries')
        .select('tip_date, amount_cents')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .gte('tip_date', data.from)
        .lte('tip_date', data.to),
      db
        .from('tip_pool_periods')
        .select('from_date,to_date')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId),
      db
        .from('memberships')
        .select('user_id')
        .eq('tenant_id', data.tenantId)
        .eq('status', 'active'),
      db.from('profiles').select('user_id, display_name'),
      db
        .from('timekeeping_events')
        .select('employee_id,event_type,occurred_at')
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .gte('occurred_at', `${data.from}T00:00:00.000Z`)
        .lt('occurred_at', `${data.to}T23:59:59.999Z`)
        .order('occurred_at'),
    ])
    if (entries.error || periods.error || members.error || profiles.error || events.error)
      throw new Error('tips_close_load_failed')
    const openEntries = (entries.data ?? []).filter(
      (entry) =>
        !(periods.data ?? []).some(
          (period) => entry.tip_date >= period.from_date && entry.tip_date <= period.to_date,
        ),
    )
    const totalCents = openEntries.reduce((sum, row) => sum + Number(row.amount_cents), 0)
    const names = new Map(
      (profiles.data ?? []).map((p) => [p.user_id as string, p.display_name as string]),
    )
    const byEmployee = new Map<string, TimeEvent[]>()
    for (const event of events.data ?? []) {
      const list = byEmployee.get(event.employee_id as string) ?? []
      list.push({ eventType: event.event_type, occurredAt: event.occurred_at as string })
      byEmployee.set(event.employee_id as string, list)
    }
    const distribution = distributeTips(
      totalCents,
      (members.data ?? []).map((m) => ({
        employeeId: m.user_id as string,
        displayName: names.get(m.user_id as string) ?? 'Empleado',
        minutes: workedMinutes(byEmployee.get(m.user_id as string) ?? []),
      })),
    )
    const { error } = await db.from('tip_pool_periods').insert({
      tenant_id: data.tenantId,
      venue_id: data.venueId,
      from_date: data.from,
      to_date: data.to,
      total_cents: totalCents,
      closed_by: context.tenantMembership.userId,
    })
    if (error) throw new Error(`tips_close_failed:${error.code}`)
    return { totalCents, distribution }
  })
