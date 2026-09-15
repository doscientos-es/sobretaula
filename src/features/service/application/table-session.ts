import type { SupabaseClient } from '@supabase/supabase-js'

export interface TableSessionInsert {
  covers: number
  opened_by: string
  operation_id: string | null
  status: 'open'
  table_ids: string[]
  tenant_id: string
  venue_id: string
}

/** Inserts a session without relying on conflict inference for a partial index. */
export async function insertTableSession(
  supabase: SupabaseClient,
  payload: TableSessionInsert,
  errorPrefix: string,
): Promise<{ id: string }> {
  const { data: session, error } = await supabase
    .from('table_sessions')
    .insert(payload)
    .select('id')
    .single()
  if (!error && session) return { id: session.id as string }

  if (payload.operation_id && error?.code === '23505') {
    const { data: existing, error: lookupError } = await supabase
      .from('table_sessions')
      .select('id')
      .eq('operation_id', payload.operation_id)
      .eq('tenant_id', payload.tenant_id)
      .eq('venue_id', payload.venue_id)
      .maybeSingle()
    if (!lookupError && existing) return { id: existing.id as string }
  }

  throw new Error(`${errorPrefix}:${error?.code ?? 'unknown'}`)
}
