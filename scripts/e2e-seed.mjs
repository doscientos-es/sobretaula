// oxlint-disable no-console

import fs from 'node:fs'
import path from 'node:path'

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

loadEnv(path.resolve('.env.test'))

const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
const slug = process.env.E2E_TENANT_SLUG ?? 'la-fonda-demo'
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@example.test'
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? 'E2e-owner-password-2026!'
const managerEmail = process.env.E2E_MANAGER_EMAIL ?? 'e2e-manager@example.test'
const managerPassword = process.env.E2E_MANAGER_PASSWORD ?? 'E2e-manager-password-2026!'

if (!url || !secret)
  throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required in .env.test')

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  'Content-Type': 'application/json',
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${url}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok)
    throw new Error(`${options.method ?? 'GET'} ${endpoint}: ${response.status} ${text}`)
  return body
}

async function ensureUser(email, password, displayName) {
  const users = await request('/auth/v1/admin/users?per_page=1000')
  const existing = users.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  if (existing) {
    await request(`/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      }),
    })
    return existing.id
  }
  const created = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  })
  return created.id
}

async function main() {
  const tenants = await request(
    `/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id,slug,status`,
  )
  if (!tenants[0]) throw new Error(`Tenant ${slug} not found in Supabase-dev`)

  const tenantId = tenants[0].id
  const ownerId = await ensureUser(ownerEmail, ownerPassword, 'E2E Owner')
  const managerId = await ensureUser(managerEmail, managerPassword, 'E2E Manager')

  await request('/rest/v1/memberships?on_conflict=tenant_id,user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([
      { tenant_id: tenantId, user_id: ownerId, role: 'owner', status: 'active' },
      { tenant_id: tenantId, user_id: managerId, role: 'manager', status: 'active' },
    ]),
  })

  console.log(JSON.stringify({ tenant: slug, tenantId, ownerEmail, managerEmail }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
