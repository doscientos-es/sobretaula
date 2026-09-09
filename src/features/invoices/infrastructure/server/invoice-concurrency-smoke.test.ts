import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const testUrl = process.env.SUPABASE_TEST_URL
const testPublishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY
const testSecretKey = process.env.SUPABASE_TEST_SECRET_KEY
const configured = Boolean(testUrl && testPublishableKey && testSecretKey)

const describeSmoke = configured ? describe : describe.skip

interface Fixture {
  cleanup: () => Promise<void>
  seriesId: string
  userClient: SupabaseClient
}

let fixture: Fixture | undefined

function requiredEnvironment(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}.`)
  return value
}

function adminClient(): SupabaseClient {
  return createClient(
    requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
    requiredEnvironment(testSecretKey, 'SUPABASE_TEST_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

describeSmoke('invoice number reservation concurrency', () => {
  beforeAll(async () => {
    const admin = adminClient()
    const nonce = randomUUID()
    const tenantId = randomUUID()
    const email = `smoke-inv-${nonce}@example.test`
    const password = `SmokeInv-${nonce}-aA1!`

    const { error: tenantError } = await admin.from('tenants').insert({
      id: tenantId,
      name: `Smoke Inv ${nonce}`,
      slug: `smoke-inv-${nonce.slice(0, 8)}`,
      status: 'active',
    })
    if (tenantError) throw tenantError

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
    })
    if (createError || !created.user) throw createError ?? new Error('Test user was not created.')

    const { error: membershipError } = await admin
      .from('memberships')
      .insert({ role: 'owner', tenant_id: tenantId, user_id: created.user.id })
    if (membershipError) throw membershipError

    const anonymous = createClient(
      requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
      requiredEnvironment(testPublishableKey, 'SUPABASE_TEST_PUBLISHABLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: signedIn, error: signInError } = await anonymous.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError || !signedIn.session) {
      throw signInError ?? new Error('Test user could not sign in.')
    }

    const userClient = createClient(
      requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
      requiredEnvironment(testPublishableKey, 'SUPABASE_TEST_PUBLISHABLE_KEY'),
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${signedIn.session.access_token}` } },
      },
    )

    const { data: series, error: seriesError } = await admin
      .from('invoice_series')
      .insert({ code: 'SMK', fiscal_year: new Date().getFullYear(), tenant_id: tenantId })
      .select('id')
      .single()
    if (seriesError) throw seriesError

    fixture = {
      cleanup: async () => {
        await admin.from('tenants').delete().eq('id', tenantId)
        await admin.auth.admin.deleteUser(created.user.id)
      },
      seriesId: series.id as string,
      userClient,
    }
  })

  afterAll(async () => {
    if (fixture) await fixture.cleanup()
  })

  it('assigns unique consecutive numbers to concurrent reservations', async () => {
    if (!fixture) throw new Error('Smoke fixture is unavailable.')

    const [first, second] = await Promise.all([
      fixture.userClient.rpc('reserve_invoice_number', { p_series_id: fixture.seriesId }),
      fixture.userClient.rpc('reserve_invoice_number', { p_series_id: fixture.seriesId }),
    ])

    expect(first.error).toBeNull()
    expect(second.error).toBeNull()
    const numbers = [first.data as number, second.data as number].sort((a, b) => a - b)
    expect(numbers[1] - numbers[0]).toBe(1)
  })

  it('rejects reservation without a membership role allowed to invoice', async () => {
    if (!fixture) throw new Error('Smoke fixture is unavailable.')
    // anon (sin sesión) contra la RPC: debe fallar por permisos, no colarse.
    const anonymous = createClient(
      requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
      requiredEnvironment(testPublishableKey, 'SUPABASE_TEST_PUBLISHABLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { error } = await anonymous.rpc('reserve_invoice_number', {
      p_series_id: fixture.seriesId,
    })
    expect(error).not.toBeNull()
  })
})
