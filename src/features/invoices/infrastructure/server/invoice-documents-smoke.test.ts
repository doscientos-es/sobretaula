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
  objectPath: string
  ownerClient: SupabaseClient
  otherTenantUserId: string
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

async function signIn(
  email: string,
  password: string,
): Promise<{ client: SupabaseClient; token: string }> {
  const anonymous = createClient(
    requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
    requiredEnvironment(testPublishableKey, 'SUPABASE_TEST_PUBLISHABLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data, error } = await anonymous.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw error ?? new Error('Could not sign in.')
  return {
    client: createClient(
      requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
      requiredEnvironment(testPublishableKey, 'SUPABASE_TEST_PUBLISHABLE_KEY'),
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      },
    ),
    token: data.session.access_token,
  }
}

async function createTenantOwner(
  prefix: string,
): Promise<{ tenantId: string; email: string; password: string; userId: string }> {
  const admin = adminClient()
  const nonce = randomUUID()
  const tenantId = randomUUID()
  const email = `smoke-pdf-${prefix}-${nonce}@example.test`
  const password = `SmokePdf-${nonce}-aA1!`

  const { error: tenantError } = await admin.from('tenants').insert({
    id: tenantId,
    name: `Smoke Pdf ${prefix} ${nonce}`,
    slug: `smoke-pdf-${prefix}-${nonce.slice(0, 8)}`,
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

  return { email, password, tenantId, userId: created.user.id }
}

describeSmoke('private invoice documents storage', () => {
  beforeAll(async () => {
    const admin = adminClient()
    const owner = await createTenantOwner('a')
    const other = await createTenantOwner('b')

    const { data: upload, error: uploadError } = await admin.storage
      .from('invoice_documents')
      .upload(`${owner.tenantId}/smoke-${randomUUID()}.pdf`, '%PDF-1.4 smoke', {
        contentType: 'application/pdf',
      })
    if (uploadError) throw uploadError

    const ownerSession = await signIn(owner.email, owner.password)
    fixture = {
      cleanup: async () => {
        await admin.storage.from('invoice_documents').remove([upload.path])
        await admin.from('tenants').delete().in('id', [owner.tenantId, other.tenantId])
        await Promise.all([
          admin.auth.admin.deleteUser(owner.userId),
          admin.auth.admin.deleteUser(other.userId),
        ])
      },
      objectPath: upload.path,
      otherTenantUserId: other.userId,
      ownerClient: ownerSession.client,
    }
  })

  afterAll(async () => {
    if (fixture) await fixture.cleanup()
  })

  it('blocks a cross-tenant signed URL request', async () => {
    if (!fixture) throw new Error('Smoke fixture is unavailable.')
    // El propietario de otro tenant no puede crear URL firmada del objeto ajeno.
    const { data, error } = await fixture.ownerClient.storage
      .from('invoice_documents')
      .createSignedUrl(fixture.objectPath, 60)
    expect(error).not.toBeNull()
    expect(data?.signedUrl).toBeUndefined()
  })

  it('never exposes the object to an anonymous request', async () => {
    if (!fixture) throw new Error('Smoke fixture is unavailable.')
    const anonymous = publicClient()
    const { data } = await anonymous.storage
      .from('invoice_documents')
      .createSignedUrl(fixture.objectPath, 60)
    expect(data?.signedUrl).toBeUndefined()
  })

  it('allows the owning tenant to read its own document', async () => {
    if (!fixture) throw new Error('Smoke fixture is unavailable.')
    const { data, error } = await fixture.ownerClient.storage
      .from('invoice_documents')
      .createSignedUrl(fixture.objectPath, 60)
    expect(error).toBeNull()
    expect(data?.signedUrl).toBeTruthy()
  })
})

function publicClient(): SupabaseClient {
  return createClient(
    requiredEnvironment(testUrl, 'SUPABASE_TEST_URL'),
    requiredEnvironment(testPublishableKey, 'SUPABASE_TEST_PUBLISHABLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
