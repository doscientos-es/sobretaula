import fs from 'node:fs'
import path from 'node:path'

import { test as setup, expect } from '@playwright/test'

const authFile = process.env.E2E_STORAGE_STATE ?? 'e2e/.auth/owner.json'

setup('authenticate E2E owner against Supabase-dev', async ({ page }) => {
  const email = process.env.E2E_OWNER_EMAIL
  const password = process.env.E2E_OWNER_PASSWORD

  setup.skip(!email || !password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for Supabase-dev')
  if (!email || !password) return

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.getByLabel(/correo|email/i).fill(email)
    await page.getByRole('textbox', { name: /contraseña|password/i }).fill(password)
    await page.getByRole('button', { name: /iniciar sesión|entrar|acceder/i }).click()
    try {
      await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 })
      break
    } catch (error) {
      if (attempt === 3) throw error
    }
  }

  fs.mkdirSync(path.dirname(path.resolve(authFile)), { recursive: true })
  await page.context().storageState({ path: authFile })
})
