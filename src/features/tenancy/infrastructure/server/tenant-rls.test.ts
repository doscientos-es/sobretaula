import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const testUrl = process.env.SUPABASE_TEST_URL
const testPublishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY
const testSecretKey = process.env.SUPABASE_TEST_SECRET_KEY
const configured = Boolean(testUrl && testPublishableKey && testSecretKey)

const describeRls = configured ? describe : describe.skip

interface Fixture {
  tenantAId: string
  tenantBId: string
  userAId: string
  userBId: string
  userA: SupabaseClient
  userB: SupabaseClient
}

let fixture: Fixture | undefined

function requiredEnvironment(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}.`)
  return value
}

function createAdminClient(): SupabaseClient {
  return createClient(
    requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
    requiredEnvironment(testSecretKey, 'SUPABASE_TEST_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function createAuthenticatedClient(
  email: string,
): Promise<{ client: SupabaseClient; userId: string }> {
  const anonymous = createClient(
    requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
    requiredEnvironment(testPublishableKey, 'SUPABASE_TEST_PUBLISHABLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const password = `RlsTest-${randomUUID()}-aA1!`
  const { data: created, error: createError } = await createAdminClient().auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  })
  if (createError || !created.user) throw createError ?? new Error('Test user was not created.')

  const { data: signedIn, error: signInError } = await anonymous.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !signedIn.session) {
    throw signInError ?? new Error('Test user could not sign in.')
  }

  return {
    client: createClient(
      requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
      requiredEnvironment(testPublishableKey, 'SUPABASE_TEST_PUBLISHABLE_KEY'),
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${signedIn.session.access_token}` } },
      },
    ),
    userId: created.user.id,
  }
}

describeRls('tenant RLS isolation', () => {
  beforeAll(async () => {
    const admin = createAdminClient()
    const nonce = randomUUID()
    const tenantAId = randomUUID()
    const tenantBId = randomUUID()
    const userA = await createAuthenticatedClient(`rls-a-${nonce}@example.test`)
    const userB = await createAuthenticatedClient(`rls-b-${nonce}@example.test`)

    const { error: tenantError } = await admin.from('tenants').insert([
      {
        id: tenantAId,
        name: `RLS A ${nonce}`,
        slug: `rls-a-${nonce.slice(0, 8)}`,
        status: 'active',
      },
      {
        id: tenantBId,
        name: `RLS B ${nonce}`,
        slug: `rls-b-${nonce.slice(0, 8)}`,
        status: 'active',
      },
    ])
    if (tenantError) throw tenantError

    const { error: membershipError } = await admin.from('memberships').insert([
      { role: 'owner', tenant_id: tenantAId, user_id: userA.userId },
      { role: 'owner', tenant_id: tenantBId, user_id: userB.userId },
    ])
    if (membershipError) throw membershipError

    const { error: venueError } = await admin.from('venues').insert([
      { name: `Venue A ${nonce}`, tenant_id: tenantAId },
      { name: `Venue B ${nonce}`, tenant_id: tenantBId },
    ])
    if (venueError) throw venueError

    fixture = {
      tenantAId,
      tenantBId,
      userA: userA.client,
      userAId: userA.userId,
      userB: userB.client,
      userBId: userB.userId,
    }
  })

  afterAll(async () => {
    if (!fixture) return
    const admin = createAdminClient()
    await admin.from('tenants').delete().in('id', [fixture.tenantAId, fixture.tenantBId])
    await Promise.all([
      admin.auth.admin.deleteUser(fixture.userAId),
      admin.auth.admin.deleteUser(fixture.userBId),
    ])
  })

  it('only returns rows from the signed-in user tenant', async () => {
    if (!fixture) throw new Error('RLS fixture is unavailable.')

    const { data, error } = await fixture.userA.from('venues').select('tenant_id')

    expect(error).toBeNull()
    expect(data).toEqual([{ tenant_id: fixture.tenantAId }])
  })

  it('rejects a write against a tenant where the user has no membership', async () => {
    if (!fixture) throw new Error('RLS fixture is unavailable.')

    const { error } = await fixture.userA
      .from('venues')
      .insert({ name: 'Forbidden cross-tenant venue', tenant_id: fixture.tenantBId })

    expect(error).not.toBeNull()
  })
})
