import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

/**
 * Browser client for ordinary reads and writes. VITE_* values are public by
 * design; every table is protected by RLS.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient

  const { VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey, VITE_SUPABASE_URL: url } = import.meta.env
  if (!url || !publishableKey) {
    throw new Error(
      'Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY para usar Supabase.',
    )
  }

  browserClient = createClient(url, publishableKey)
  return browserClient
}
