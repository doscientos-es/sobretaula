import { test, expect } from '@playwright/test'

test.describe('protected route boundaries', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const path of ['/admin', '/t/la-fonda-demo', '/t/la-fonda-demo/l/principal/tpv']) {
    test(`${path} redirects anonymous users to login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp('/login'))
    })
  }
})

test.describe('authenticated tenant boundaries', () => {
  test.skip(
    !process.env.E2E_STORAGE_STATE,
    'Requires E2E_STORAGE_STATE from a non-production Supabase-dev account',
  )

  test('owner can open the tenant dashboard', async ({ page }) => {
    await page.goto('/t/la-fonda-demo')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).not.toContainText(/Unauthenticated|Something went wrong/i)
  })
})
