import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? (fallback === undefined ? undefined : process.env[fallback])
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`)
  return value
}

/** El proyecto es el mismo en cliente y servidor: las VITE_* valen de respaldo. */
function supabaseUrl(): string {
  return readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
}

function supabasePublishableKey(): string {
  return readEnv('SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY')
}

/**
 * Anonymous server client. Reaches exactly what an unauthenticated visitor
 * reaches, so it is safe for pre-session lookups such as tenant branding.
 */
export function createAnonSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Request-scoped client that keeps acting as the signed-in user, so RLS stays
 * in force on the server too. Used by server functions, never by the bundle.
 */
export function createRequestSupabaseClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

/**
 * Bypasses RLS. Only for platform work that has no user context: tenant
 * provisioning, fiscal ledger writes and outbox delivery.
 */
export function createServiceSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl(), readEnv('SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
