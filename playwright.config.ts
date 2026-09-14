import fs from 'node:fs'
import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

function loadTestEnv() {
  const envPath = path.resolve('.env.test')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

loadTestEnv()
process.env.SUPABASE_URL ??= process.env.SUPABASE_TEST_URL
process.env.SUPABASE_SECRET_KEY ??= process.env.SUPABASE_TEST_SECRET_KEY
process.env.VITE_SUPABASE_URL ??= process.env.SUPABASE_TEST_URL
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= process.env.SUPABASE_TEST_PUBLISHABLE_KEY

const authState = process.env.E2E_STORAGE_STATE ?? 'e2e/.auth/owner.json'
const authStatePath = fs.existsSync(path.resolve(authState)) ? authState : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup-auth',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup-auth'],
      use: { ...devices['Desktop Chrome'], storageState: authStatePath },
    },
  ],
})
