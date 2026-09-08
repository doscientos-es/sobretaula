import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function readEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`)
  return value
}

/**
 * Request-scoped client that keeps acting as the signed-in user, so RLS stays
 * in force on the server too. Used by server functions, never by the bundle.
 */
export function createRequestSupabaseClient(accessToken: string): SupabaseClient {
  return createClient(readEnv('SUPABASE_URL'), readEnv('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

/**
 * Bypasses RLS. Only for platform work that has no user context: tenant
 * provisioning, fiscal ledger writes and outbox delivery.
 */
export function createServiceSupabaseClient(): SupabaseClient {
  return createClient(readEnv('SUPABASE_URL'), readEnv('SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
