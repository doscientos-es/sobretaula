import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const searchInput = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
  query: z.string().trim().max(100).default(''),
})
const noteInput = z.object({
  tenantId: z.string().uuid(),
  guestId: z.string().uuid(),
  category: z.enum(['general', 'preference', 'allergy', 'incident']).default('general'),
  body: z.string().trim().min(1).max(2000),
})
const tagInput = z.object({
  tenantId: z.string().uuid(),
  guestId: z.string().uuid(),
  tagId: z.string().uuid(),
})
const tagsInput = z.object({ tenantId: z.string().uuid() })
const mergeInput = z.object({
  tenantId: z.string().uuid(),
  sourceGuestId: z.string().uuid(),
  targetGuestId: z.string().uuid(),
})

export interface GuestSummary {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  reservations: number
  visits: number
  spendCents: number
  tags: string[]
  history: Array<{ body: string; category: string; createdAt: string }>
}

export const searchGuests = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(searchInput)
  .handler(async ({ context, data }): Promise<GuestSummary[]> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    let request = supabase
      .from('guests')
      .select('email, full_name, id, notes, phone')
      .eq('tenant_id', data.tenantId)
      .order('full_name')
      .limit(50)
    if (data.query)
      request = request.or(
        `full_name.ilike.%${data.query}%,phone.ilike.%${data.query}%,email.ilike.%${data.query}%`,
      )
    const { data: guests, error } = await request
    if (error) throw new Error(`guests_search_failed:${error.code}`)
    const ids = (guests ?? []).map((guest) => guest.id)
    const { data: reservations, error: reservationsError } = ids.length
      ? await supabase
          .from('reservations')
          .select('guest_id, id')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .in('guest_id', ids)
      : { data: [], error: null }
    if (reservationsError) throw new Error(`guest_reservations_failed:${reservationsError.code}`)
    const reservationIds = (reservations ?? []).map((row) => row.id)
    const { data: sessions, error: sessionsError } = reservationIds.length
      ? await supabase
          .from('table_sessions')
          .select('id, reservation_id, status')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', data.venueId)
          .eq('status', 'closed')
          .in('reservation_id', reservationIds)
      : { data: [], error: null }
    if (sessionsError) throw new Error(`guest_visits_failed:${sessionsError.code}`)
    const { data: payments, error: paymentsError } = (sessions ?? []).length
      ? await supabase
          .from('payments')
          .select('amount_cents, session_id')
          .eq('tenant_id', data.tenantId)
          .in(
            'session_id',
            (sessions ?? []).map((session) => session.id),
          )
      : { data: [], error: null }
    if (paymentsError) throw new Error(`guest_spend_failed:${paymentsError.code}`)
    const [assignmentsResult, notesResult] = ids.length
      ? await Promise.all([
          supabase
            .from('guest_tag_assignments')
            .select('guest_id, guest_tags(label)')
            .eq('tenant_id', data.tenantId)
            .in('guest_id', ids),
          supabase
            .from('guest_notes')
            .select('body, category, created_at, guest_id')
            .eq('tenant_id', data.tenantId)
            .in('guest_id', ids)
            .order('created_at', { ascending: false })
            .limit(200),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ]
    if (assignmentsResult.error || notesResult.error) throw new Error('guest_profile_load_failed')
    const counts = new Map<string, number>()
    for (const row of reservations ?? [])
      counts.set(row.guest_id, (counts.get(row.guest_id) ?? 0) + 1)
    const reservationGuest = new Map((reservations ?? []).map((row) => [row.id, row.guest_id]))
    const visits = new Map<string, number>()
    for (const session of sessions ?? []) {
      const guestId = reservationGuest.get(session.reservation_id)
      if (guestId) visits.set(guestId, (visits.get(guestId) ?? 0) + 1)
    }
    const spend = new Map<string, number>()
    const sessionGuest = new Map(
      (sessions ?? []).map((session) => [session.id, reservationGuest.get(session.reservation_id)]),
    )
    for (const payment of payments ?? []) {
      const guestId = sessionGuest.get(payment.session_id)
      if (guestId) spend.set(guestId, (spend.get(guestId) ?? 0) + payment.amount_cents)
    }
    const tags = new Map<string, string[]>()
    for (const assignment of assignmentsResult.data ?? []) {
      const relation = assignment.guest_tags as unknown as
        | { label?: string }
        | { label?: string }[]
        | null
      const label = (Array.isArray(relation) ? relation[0] : relation)?.label
      if (label) tags.set(assignment.guest_id, [...(tags.get(assignment.guest_id) ?? []), label])
    }
    const history = new Map<string, Array<{ body: string; category: string; createdAt: string }>>()
    for (const note of notesResult.data ?? [])
      history.set(note.guest_id, [
        ...(history.get(note.guest_id) ?? []),
        { body: note.body, category: note.category, createdAt: note.created_at },
      ])
    return (guests ?? []).map((guest) => ({
      id: guest.id,
      name: guest.full_name,
      phone: guest.phone,
      email: guest.email,
      notes: guest.notes,
      reservations: counts.get(guest.id) ?? 0,
      visits: visits.get(guest.id) ?? 0,
      spendCents: spend.get(guest.id) ?? 0,
      tags: tags.get(guest.id) ?? [],
      history: history.get(guest.id) ?? [],
    }))
  })

export const addGuestNote = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(noteInput)
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { error } = await supabase.from('guest_notes').insert({
      tenant_id: data.tenantId,
      guest_id: data.guestId,
      category: data.category,
      body: data.body,
      author_user_id: context.principal.userId,
    })
    if (error) throw new Error(`guest_note_create_failed:${error.code}`)
  })

export const getGuestTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(tagsInput)
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: tags, error } = await supabase
      .from('guest_tags')
      .select('id, label, slug, color, is_system')
      .eq('tenant_id', data.tenantId)
      .order('label')
    if (error) throw new Error(`guest_tags_load_failed:${error.code}`)
    return tags ?? []
  })

export const toggleGuestTag = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(tagInput)
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: existing, error: lookupError } = await supabase
      .from('guest_tag_assignments')
      .select('guest_id')
      .eq('tenant_id', data.tenantId)
      .eq('guest_id', data.guestId)
      .eq('tag_id', data.tagId)
      .maybeSingle()
    if (lookupError) throw new Error(`guest_tag_lookup_failed:${lookupError.code}`)
    if (existing) {
      const { error } = await supabase
        .from('guest_tag_assignments')
        .delete()
        .eq('tenant_id', data.tenantId)
        .eq('guest_id', data.guestId)
        .eq('tag_id', data.tagId)
      if (error) throw new Error(`guest_tag_remove_failed:${error.code}`)
      return false
    }
    const { error } = await supabase.from('guest_tag_assignments').insert({
      tenant_id: data.tenantId,
      guest_id: data.guestId,
      tag_id: data.tagId,
      assigned_by: context.principal.userId,
    })
    if (error) throw new Error(`guest_tag_assign_failed:${error.code}`)
    return true
  })

export const mergeGuests = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(mergeInput)
  .handler(async ({ context, data }) => {
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken).rpc(
      'merge_guests',
      {
        p_source_guest_id: data.sourceGuestId,
        p_target_guest_id: data.targetGuestId,
        p_tenant_id: data.tenantId,
      },
    )
    if (error) throw new Error(`guest_merge_failed:${error.code}`)
    return data.targetGuestId
  })
