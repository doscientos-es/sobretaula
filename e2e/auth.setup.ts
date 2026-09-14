import fs from 'node:fs'
import path from 'node:path'

import { test as setup, expect } from '@playwright/test'

const authFile = process.env.E2E_STORAGE_STATE ?? 'e2e/.auth/owner.json'

setup('authenticate E2E owner against Supabase-dev', async ({ page }) => {
  const email = process.env.E2E_OWNER_EMAIL
  const password = process.env.E2E_OWNER_PASSWORD

  setup.skip(!email || !password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for Supabase-dev')
  if (!email || !password) return

  await page.goto('/login')
  await page.getByLabel(/correo|email/i).fill(email)
  await page.getByLabel(/contraseña|password/i).fill(password)
  await page.getByRole('button', { name: /iniciar sesión|entrar|acceder/i }).click()
  await expect(page).not.toHaveURL(/\/login/)

  fs.mkdirSync(path.dirname(path.resolve(authFile)), { recursive: true })
  await page.context().storageState({ path: authFile })
})
