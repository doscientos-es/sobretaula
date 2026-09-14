import fs from 'node:fs'
import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

function loadEnvFile(fileName: string) {
  const envPath = path.resolve(fileName)
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env.test')
process.env.E2E_TEST_MODE = 'true'
process.env.E2E_TEST_ROLE ??= 'owner'
process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_TEST_SECRET_KEY
process.env.VITE_SUPABASE_URL = process.env.SUPABASE_TEST_URL
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_TEST_PUBLISHABLE_KEY

const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results'
const reportDir = process.env.PLAYWRIGHT_REPORT_DIR ?? 'playwright-report'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: reportDir, open: 'never' }]]
    : [['list'], ['html', { outputFolder: reportDir, open: 'never' }]],
  outputDir,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  ...(process.env.E2E_NO_SERVER
    ? {}
    : {
        webServer: {
          command: 'pnpm.cmd exec vite dev --mode test --host 127.0.0.1 --port 3001',
          url: 'http://127.0.0.1:3001/login',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
  projects: [
    {
      name: 'public',
      testMatch: /smoke\.spec\.ts/,
      grep: /public reservation|cacheable/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'setup-auth',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup-auth'],
      testMatch: /(?:authorization|smoke)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: process.env.E2E_STORAGE_STATE ?? 'e2e/.auth/owner.json',
      },
    },
    ...['owner', 'manager', 'host', 'waiter', 'accountant'].map((role) => ({
      name: role,
      dependencies: ['setup-auth'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: `e2e/.auth/${role}.json`,
      },
      testMatch: /operational-flows\.spec\.ts/,
    })),
  ],
})
