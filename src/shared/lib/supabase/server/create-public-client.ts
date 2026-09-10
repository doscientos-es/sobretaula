import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Anonymous server client for narrowly scoped public RPCs. */
export function createPublicSupabaseClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('supabase_public_config_missing')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
