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

const hasTestProject = Boolean(
  process.env.SUPABASE_TEST_URL &&
  process.env.SUPABASE_TEST_PUBLISHABLE_KEY &&
  process.env.SUPABASE_TEST_SECRET_KEY,
)

// The application reads the canonical SUPABASE_* names while the E2E
// environment deliberately stores isolated credentials under SUPABASE_TEST_*.
// Bridge them only for this Playwright process so server actions cannot drift
// to another project when the test server starts.
if (hasTestProject) {
  for (const [testName, appName] of [
    ['SUPABASE_TEST_URL', 'SUPABASE_URL'],
    ['SUPABASE_TEST_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY'],
    ['SUPABASE_TEST_SECRET_KEY', 'SUPABASE_SECRET_KEY'],
  ] as const) {
    process.env[appName] = process.env[testName]
  }
}
process.env.E2E_TEST_MODE = hasTestProject ? 'true' : 'false'
process.env.E2E_TEST_ROLE ??= 'owner'
if (hasTestProject) process.env.VITE_SUPABASE_URL = process.env.SUPABASE_TEST_URL
if (hasTestProject)
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_TEST_PUBLISHABLE_KEY

const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results'
const reportDir = process.env.PLAYWRIGHT_REPORT_DIR ?? 'playwright-report'
const authStatePath = path.resolve(process.env.E2E_STORAGE_STATE ?? 'e2e/.auth/owner.json')
const hasAuthenticatedSmoke = hasTestProject || fs.existsSync(authStatePath)
const roles = ['owner', 'manager', 'host', 'waiter', 'accountant'] as const
const hasRoleStates =
  hasTestProject || roles.every((role) => fs.existsSync(path.resolve(`e2e/.auth/${role}.json`)))

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
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  ...(process.env.E2E_NO_SERVER
    ? {}
    : {
        webServer: {
          command: 'pnpm.cmd exec vite dev --mode test --host 127.0.0.1 --port 3001',
          url: 'http://localhost:3001/login',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
  projects: [
    {
      name: 'public',
      dependencies: ['setup-auth'],
      testMatch: /smoke\.spec\.ts/,
      grep: /public reservation|cacheable|invalid reservation|team invitation requires|platform invitation/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'setup-auth',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    ...(hasAuthenticatedSmoke
      ? [
          {
            name: 'chromium',
            dependencies: ['setup-auth'],
            testMatch: /(?:authorization|smoke)\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], storageState: authStatePath },
          },
        ]
      : []),
    ...(hasRoleStates
      ? roles.map((role) => ({
          name: role,
          dependencies: ['setup-auth'],
          use: {
            ...devices['Desktop Chrome'],
            storageState: path.resolve(`e2e/.auth/${role}.json`),
          },
          testMatch: /operational-flows\.spec\.ts/,
        }))
      : []),
  ],
})
