// oxlint-disable no-console

import fs from 'node:fs'
import path from 'node:path'

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

loadEnv(path.resolve('.env.test'))

const url = process.env.SUPABASE_TEST_URL
const secret = process.env.SUPABASE_TEST_SECRET_KEY
const slug = process.env.E2E_TENANT_SLUG ?? 'la-fonda-demo'
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@example.test'
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? 'E2e-owner-password-2026!'
const managerEmail = process.env.E2E_MANAGER_EMAIL ?? 'e2e-manager@example.test'
const managerPassword = process.env.E2E_MANAGER_PASSWORD ?? 'E2e-manager-password-2026!'
const roleCredentials = {
  owner: [ownerEmail, ownerPassword, 'E2E Owner'],
  manager: [managerEmail, managerPassword, 'E2E Manager'],
  host: [
    process.env.E2E_HOST_EMAIL ?? 'e2e-host@example.test',
    process.env.E2E_HOST_PASSWORD ?? 'E2e-host-password-2026!',
    'E2E Host',
  ],
  waiter: [
    process.env.E2E_WAITER_EMAIL ?? 'e2e-waiter@example.test',
    process.env.E2E_WAITER_PASSWORD ?? 'E2e-waiter-password-2026!',
    'E2E Waiter',
  ],
  accountant: [
    process.env.E2E_ACCOUNTANT_EMAIL ?? 'e2e-accountant@example.test',
    process.env.E2E_ACCOUNTANT_PASSWORD ?? 'E2e-accountant-password-2026!',
    'E2E Accountant',
  ],
}

if (!url || !secret)
  throw new Error('SUPABASE_TEST_URL and SUPABASE_TEST_SECRET_KEY are required in .env.test')

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
  let tenantId = tenants[0]?.id
  if (!tenantId) {
    const created = await request('/rest/v1/tenants', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        slug,
        name: 'La Fonda Demo',
        status: 'active',
        default_locale: 'es',
        timezone: 'Europe/Madrid',
      }),
    })
    tenantId = created[0].id
  } else {
    await request(`/rest/v1/tenants?id=eq.${tenantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    })
  }

  const venues = await request(
    `/rest/v1/venues?tenant_id=eq.${tenantId}&select=id&order=created_at.asc&limit=1`,
  )
  let venueId = venues[0]?.id
  if (!venueId) {
    const created = await request('/rest/v1/venues', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        tenant_id: tenantId,
        name: 'Principal',
        slug: 'principal',
        is_active: true,
        city: 'Madrid',
        country_code: 'ES',
        capacity: 80,
      }),
    })
    venueId = created[0].id
  }

  const areaDefinitions = [
    { name: 'Interior', assignment_priority: 10 },
    { name: 'Terraza', assignment_priority: 20 },
    { name: 'Barra', assignment_priority: 30 },
  ]
  const areas = []
  for (const area of areaDefinitions) {
    const existing = await request(
      `/rest/v1/areas?tenant_id=eq.${tenantId}&venue_id=eq.${venueId}&name=eq.${encodeURIComponent(area.name)}&select=id&limit=1`,
    )
    if (existing[0]) areas.push(existing[0])
    else {
      const created = await request('/rest/v1/areas', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...area, tenant_id: tenantId, venue_id: venueId }),
      })
      areas.push(created[0])
    }
  }
  const tableDefinitions = [
    ['I01', 'round', 2, 2, 160, 120],
    ['I02', 'square', 2, 4, 320, 120],
    ['I03', 'rectangle', 4, 6, 480, 120],
    ['I04', 'rectangle', 4, 8, 640, 120],
    ['T01', 'round', 2, 4, 160, 420],
    ['T02', 'round', 2, 4, 320, 420],
    ['B01', 'rectangle', 1, 2, 560, 420],
  ]
  for (const [code, shape, min_seats, max_seats, x_cm, y_cm] of tableDefinitions) {
    const area = areas[code.startsWith('T') ? 1 : code.startsWith('B') ? 2 : 0]
    const existing = await request(
      `/rest/v1/tables?tenant_id=eq.${tenantId}&venue_id=eq.${venueId}&code=eq.${code}&select=id&limit=1`,
    )
    const table =
      existing[0] ??
      (
        await request('/rest/v1/tables', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            tenant_id: tenantId,
            venue_id: venueId,
            area_id: area.id,
            code,
            shape,
            min_seats,
            max_seats,
          }),
        })
      )[0]
    const versions = await request(
      `/rest/v1/floor_plan_versions?tenant_id=eq.${tenantId}&area_id=eq.${area.id}&select=id&limit=1`,
    )
    const version =
      versions[0] ??
      (
        await request('/rest/v1/floor_plan_versions', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            tenant_id: tenantId,
            area_id: area.id,
            name: `${area.name} - servicio`,
            width_cm: 900,
            height_cm: 600,
          }),
        })
      )[0]
    const placements = await request(
      `/rest/v1/table_placements?floor_plan_version_id=eq.${version.id}&table_id=eq.${table.id}&select=id&limit=1`,
    )
    if (!placements[0])
      await request('/rest/v1/table_placements', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          tenant_id: tenantId,
          floor_plan_version_id: version.id,
          table_id: table.id,
          x_cm,
          y_cm,
          width_cm: 100,
          height_cm: 100,
        }),
      })
  }

  const menu = [
    [
      'Entrantes',
      [
        ['Pan de masa madre', 280, 1000],
        ['Ensalada de tomate', 850, 1000],
      ],
    ],
    [
      'Principales',
      [
        ['Arroz del día', 1650, 1000],
        ['Pollo a la brasa', 1450, 1000],
      ],
    ],
    ['Postres', [['Tarta de queso', 650, 1000]]],
    [
      'Bebidas',
      [
        ['Agua mineral', 250, 1000],
        ['Copa de vino', 450, 2100],
      ],
    ],
  ]
  for (const [categoryName, items] of menu) {
    const categories = await request(
      `/rest/v1/menu_categories?tenant_id=eq.${tenantId}&name_i18n->>es=eq.${encodeURIComponent(categoryName)}&select=id&limit=1`,
    )
    const category =
      categories[0] ??
      (
        await request('/rest/v1/menu_categories', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            tenant_id: tenantId,
            name_i18n: { es: categoryName, ca: categoryName },
            is_active: true,
          }),
        })
      )[0]
    for (const [name, price_cents, vat_rate_bps] of items) {
      const sku = `E2E-${String(name)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')}`
      const existing = await request(
        `/rest/v1/menu_items?tenant_id=eq.${tenantId}&sku=eq.${encodeURIComponent(sku)}&select=id&limit=1`,
      )
      if (!existing[0])
        await request('/rest/v1/menu_items', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            tenant_id: tenantId,
            category_id: category.id,
            sku,
            name_i18n: { es: name, ca: name },
            description_i18n: { es: 'Preparación de prueba E2E' },
            price_cents,
            vat_rate_bps,
            is_active: true,
          }),
        })
    }
  }

  const services = await request(
    `/rest/v1/services?tenant_id=eq.${tenantId}&venue_id=eq.${venueId}&select=id,name,weekday`,
  )
  if (services.length < 2) {
    const candidates = [
      { name: 'Comida', weekday: 6, starts_at_time: '13:00:00', ends_at_time: '16:00:00' },
      { name: 'Cena', weekday: 6, starts_at_time: '20:00:00', ends_at_time: '23:00:00' },
    ].filter((candidate) => !services.some((service) => service.name === candidate.name))
    const created = await request('/rest/v1/services', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(
        candidates.map((service) => ({
          ...service,
          tenant_id: tenantId,
          venue_id: venueId,
          is_active: true,
        })),
      ),
    })
    services.push(...created)
  }
  await request('/rest/v1/availability_rules?on_conflict=service_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(
      services.map((service) => ({
        tenant_id: tenantId,
        service_id: service.id,
        slot_minutes: 15,
        max_covers_per_slot: 30,
        max_reservations_per_slot: 8,
        max_lead_days: 90,
      })),
    ),
  })
  const users = {}
  for (const [role, [email, password, displayName]] of Object.entries(roleCredentials)) {
    users[role] = await ensureUser(email, password, displayName)
  }

  await request('/rest/v1/memberships?on_conflict=tenant_id,user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(
      Object.entries(users).map(([role, userId]) => ({
        tenant_id: tenantId,
        user_id: userId,
        role,
        status: 'active',
      })),
    ),
  })

  console.log(
    JSON.stringify(
      {
        tenant: slug,
        tenantId,
        roles: Object.fromEntries(
          Object.entries(roleCredentials).map(([role, [email]]) => [role, email]),
        ),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
