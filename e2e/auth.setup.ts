import fs from 'node:fs'
import path from 'node:path'

import { test as setup, expect } from '@playwright/test'

const roles = ['owner', 'manager', 'host', 'waiter', 'accountant'] as const
type E2ERole = (typeof roles)[number]
const defaultCredentials: Record<E2ERole, [string, string]> = {
  owner: ['e2e-owner@example.test', 'E2e-owner-password-2026!'],
  manager: ['e2e-manager@example.test', 'E2e-manager-password-2026!'],
  host: ['e2e-host@example.test', 'E2e-host-password-2026!'],
  waiter: ['e2e-waiter@example.test', 'E2e-waiter-password-2026!'],
  accountant: ['e2e-accountant@example.test', 'E2e-accountant-password-2026!'],
}
const tenantSlug = process.env.E2E_TENANT_SLUG ?? 'la-fonda-demo'

// The setup enters a real password; never persist it in failure artifacts.
setup.use({ screenshot: 'off', trace: 'off', video: 'off' })

setup('authenticate E2E roles against Supabase-test', async ({ page }) => {
  setup.slow()
  const configured = roles.map((role) => {
    const key = role.toUpperCase()
    return {
      role,
      email: process.env[`E2E_${key}_EMAIL`] ?? defaultCredentials[role][0],
      password: process.env[`E2E_${key}_PASSWORD`] ?? defaultCredentials[role][1],
    }
  })
  setup.skip(
    !process.env.SUPABASE_TEST_URL,
    'Requires SUPABASE_TEST_URL and dedicated E2E accounts',
  )
  if (!process.env.SUPABASE_TEST_URL) return
  for (const { role, email, password } of configured) {
    const statePath = path.resolve(`e2e/.auth/${role}.json`)
    if (process.env.E2E_REUSE_STORAGE_STATE !== 'false' && fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as { cookies?: unknown[] }
      if (Array.isArray(state.cookies) && state.cookies.some((cookie) =>
        typeof cookie === 'object' && cookie !== null && 'name' in cookie &&
        (cookie as { name?: unknown }).name === 'sobretaula-session')) continue
    }
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.goto('/login', { waitUntil: 'domcontentloaded' })
      await page.locator('form[aria-labelledby="login-title"]').waitFor({ state: 'visible' })
      await page.getByLabel(/correo|email/i).waitFor({ state: 'visible' })
      const emailInput = page.getByLabel(/correo|email/i)
      const passwordInput = page.getByRole('textbox', { name: /contraseña|password/i })
      await emailInput.fill('')
      await passwordInput.fill('')
      await emailInput.pressSequentially(email)
      await passwordInput.pressSequentially(password)
      await expect(emailInput).toHaveValue(email)
      await expect(passwordInput).toHaveValue(password)
      await page.getByRole('button', { name: /iniciar sesión|entrar|acceder/i }).click()
      try {
        await page.waitForURL((url) => url.pathname !== '/login', { timeout: 15000 })
        break
      } catch {
        if (attempt === 3) {
          await page.goto(`/t/${tenantSlug}`, { waitUntil: 'domcontentloaded' })
          await expect(page).not.toHaveURL(/\/login/)
        }
      }
    }
    fs.mkdirSync(path.dirname(statePath), { recursive: true })
    await page.context().storageState({ path: statePath })
    await page.context().clearCookies()
  }
})
