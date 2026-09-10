import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { operationalTenantMiddleware, tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'
import { allowedNextEvent, workedMinutes, type TimeEventType } from '../domain/timekeeping'
import { recordTimeEventInput, timekeepingInput, timekeepingReportInput } from './timekeeping-schema'
import { setPinInput, terminalTimeEventInput, verifyPinInput } from './timekeeping-schema'
import { createHash } from 'node:crypto'
const middleware = [authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware] as const
const pinHash = (pin: string) => createHash('sha256').update(pin).digest('hex')
export const getMyTimekeeping = createServerFn({ method: 'GET' }).middleware(middleware).validator(timekeepingInput).handler(async ({ context, data }) => {
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const { data: rows, error } = await supabase.from('timekeeping_events').select('event_type, occurred_at, id').eq('tenant_id', data.tenantId).eq('venue_id', data.venueId).eq('employee_id', context.tenantMembership.userId).order('occurred_at')
  if (error) throw new Error(`timekeeping_load_failed:${error.code}`)
  const events = (rows ?? []).map((row) => ({ id: row.id as string, eventType: row.event_type as TimeEventType, occurredAt: row.occurred_at as string }))
  return { events, workedMinutes: workedMinutes(events) }
})
export const recordTimeEvent = createServerFn({ method: 'POST' }).middleware(middleware).validator(recordTimeEventInput).handler(async ({ context, data }) => {
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const { data: last } = await supabase.from('timekeeping_events').select('event_type').eq('tenant_id', data.tenantId).eq('venue_id', data.venueId).eq('employee_id', context.tenantMembership.userId).order('occurred_at', { ascending: false }).limit(1).maybeSingle()
  if (!allowedNextEvent((last?.event_type as Parameters<typeof allowedNextEvent>[0]) ?? null).includes(data.eventType)) throw new Response('Invalid timekeeping transition', { status: 409 })
  const { data: event, error } = await supabase.from('timekeeping_events').insert({ tenant_id: data.tenantId, venue_id: data.venueId, employee_id: context.tenantMembership.userId, event_type: data.eventType, terminal_id: data.terminalId ?? null }).select('id').single()
  if (error || !event) throw new Error(`timekeeping_event_failed:${error?.code ?? 'unknown'}`)
  return { eventId: event.id as string, eventType: data.eventType }
})

export const exportTimekeepingCsv = createServerFn({ method: 'GET' }).middleware(middleware).validator(timekeepingReportInput).handler(async ({ context, data }) => {
  if (!['owner', 'manager'].includes(context.tenantMembership.role)) throw new Response('Forbidden', { status: 403 })
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const { data: rows, error } = await supabase.from('timekeeping_events').select('employee_id, event_type, occurred_at, terminal_id').eq('tenant_id', data.tenantId).eq('venue_id', data.venueId).gte('occurred_at', data.from).lt('occurred_at', data.to).order('employee_id').order('occurred_at')
  if (error) throw new Error(`timekeeping_export_failed:${error.code}`)
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  return ['empleado,tipo,fecha,terminal', ...(rows ?? []).map((row) => [row.employee_id, row.event_type, row.occurred_at, row.terminal_id ?? ''].map((value) => escape(String(value))).join(','))].join('\n')
})

export const setMyTimekeepingPin = createServerFn({ method: 'POST' }).middleware(middleware).validator(setPinInput).handler(async ({ context, data }) => {
  const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).from('timekeeping_pins').upsert({ tenant_id: data.tenantId, employee_id: context.tenantMembership.userId, pin_hash: pinHash(data.pin) })
  if (error) throw new Error(`timekeeping_pin_save_failed:${error.code}`)
  return { saved: true }
})

export const verifyTimekeepingPin = createServerFn({ method: 'POST' }).middleware(middleware).validator(verifyPinInput).handler(async ({ context, data }) => {
  if (!['owner', 'manager'].includes(context.tenantMembership.role) && data.employeeId !== context.tenantMembership.userId) throw new Response('Forbidden', { status: 403 })
  const { data: row, error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).from('timekeeping_pins').select('pin_hash').eq('tenant_id', data.tenantId).eq('employee_id', data.employeeId).maybeSingle()
  if (error) throw new Error(`timekeeping_pin_load_failed:${error.code}`)
  return { valid: Boolean(row && row.pin_hash === pinHash(data.pin)) }
})

export const recordTerminalTimeEvent = createServerFn({ method: 'POST' }).middleware(middleware).validator(terminalTimeEventInput).handler(async ({ context, data }) => {
  const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
  const { data: pin, error: pinError } = await supabase.from('timekeeping_pins').select('pin_hash').eq('tenant_id', data.tenantId).eq('employee_id', data.employeeId).maybeSingle()
  if (pinError) throw new Error(`timekeeping_pin_load_failed:${pinError.code}`)
  if (!pin || pin.pin_hash !== pinHash(data.pin)) throw new Response('Invalid PIN', { status: 401 })
  const { data: last } = await supabase.from('timekeeping_events').select('event_type').eq('tenant_id', data.tenantId).eq('venue_id', data.venueId).eq('employee_id', data.employeeId).order('occurred_at', { ascending: false }).limit(1).maybeSingle()
  if (!allowedNextEvent((last?.event_type as Parameters<typeof allowedNextEvent>[0]) ?? null).includes(data.eventType)) throw new Response('Invalid timekeeping transition', { status: 409 })
  const { data: event, error } = await supabase.from('timekeeping_events').insert({ tenant_id: data.tenantId, venue_id: data.venueId, employee_id: data.employeeId, event_type: data.eventType, terminal_id: data.terminalId ?? null }).select('id').single()
  if (error || !event) throw new Error(`timekeeping_event_failed:${error?.code ?? 'unknown'}`)
  return { eventId: event.id as string, eventType: data.eventType }
})
