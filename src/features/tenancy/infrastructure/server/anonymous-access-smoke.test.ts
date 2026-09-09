import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const testUrl = process.env.SUPABASE_TEST_URL
const testPublishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY
const testSecretKey = process.env.SUPABASE_TEST_SECRET_KEY
const configured = Boolean(testUrl && testPublishableKey && testSecretKey)

const describeSmoke = configured ? describe : describe.skip

interface Fixture {
  tenantId: string
  userId: string
  userEmail: string
  userPassword: string
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

function publicClient(): SupabaseClient {
  return createClient(
    requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
    requiredEnvironment(testPublishableKey, 'SUPABASE_TEST_PUBLISHABLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

describeSmoke('auth and anonymous access smoke', () => {
  beforeAll(async () => {
    const nonce = randomUUID()
    const tenantId = randomUUID()
    const email = `smoke-auth-${nonce}@example.test`
    const password = `SmokeAuth-${nonce}-aA1!`

    const { error: tenantError } = await adminClient()
      .from('tenants')
      .insert({
        id: tenantId,
        name: `Smoke Auth ${nonce}`,
        slug: `smoke-auth-${nonce.slice(0, 8)}`,
        status: 'active',
      })
    if (tenantError) throw tenantError

    const { data: created, error: createError } = await adminClient().auth.admin.createUser({
      email,
      email_confirm: true,
      password,
    })
    if (createError || !created.user) throw createError ?? new Error('Test user was not created.')

    const { error: membershipError } = await adminClient()
      .from('memberships')
      .insert({ role: 'owner', tenant_id: tenantId, user_id: created.user.id })
    if (membershipError) throw membershipError

    fixture = { tenantId, userEmail: email, userId: created.user.id, userPassword: password }
  })

  afterAll(async () => {
    if (!fixture) return
    const admin = adminClient()
    await admin.from('tenants').delete().eq('id', fixture.tenantId)
    await admin.auth.admin.deleteUser(fixture.userId)
  })

  it('rejects a wrong password and accepts the right one', async () => {
    if (!fixture) throw new Error('Smoke fixture is unavailable.')
    const anonymous = publicClient()

    const wrong = await anonymous.auth.signInWithPassword({
      email: fixture.userEmail,
      password: 'not-the-password-aA1!',
    })
    expect(wrong.error).not.toBeNull()

    const right = await anonymous.auth.signInWithPassword({
      email: fixture.userEmail,
      password: fixture.userPassword,
    })
    expect(right.error).toBeNull()
    expect(right.data.session?.user.id).toBe(fixture.userId)
  })

  it('denies anonymous reads (no rows) and writes against tenant data', async () => {
    const anonymous = publicClient()

    const { data, error } = await anonymous.from('venues').select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])

    const { error: writeError } = await anonymous
      .from('venues')
      .insert({ name: 'Anonymous venue', tenant_id: fixture?.tenantId ?? randomUUID() })
    expect(writeError).not.toBeNull()
  })
})
