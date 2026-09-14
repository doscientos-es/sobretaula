import fs from 'node:fs'
import path from 'node:path'

import { test as setup, expect } from '@playwright/test'

const authFile = process.env.E2E_STORAGE_STATE ?? 'e2e/.auth/owner.json'

// The setup enters a real password; never persist it in failure artifacts.
setup.use({ screenshot: 'off', trace: 'off', video: 'off' })

setup('authenticate E2E owner against Supabase-dev', async ({ page }) => {
  setup.slow()
  const email = process.env.E2E_OWNER_EMAIL
  const password = process.env.E2E_OWNER_PASSWORD

  setup.skip(!email || !password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for Supabase-dev')
  if (!email || !password) return

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/correo|email/i).waitFor({ state: 'visible' })
    await page.getByLabel(/correo|email/i).fill(email)
    await page.getByRole('textbox', { name: /contraseña|password/i }).fill(password)
    await page.getByRole('button', { name: /iniciar sesión|entrar|acceder/i }).click()
    try {
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 10000 })
        .not.toBe('/login')
      break
    } catch (error) {
      if (attempt === 3) throw error
    }
  }

  fs.mkdirSync(path.dirname(path.resolve(authFile)), { recursive: true })
  await page.context().storageState({ path: authFile })
})
