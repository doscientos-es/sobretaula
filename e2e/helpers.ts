import { expect, type Page } from '@playwright/test'

export const tenant = process.env.E2E_TENANT_SLUG ?? 'la-fonda-demo'
export const venue = process.env.E2E_VENUE_SLUG ?? 'principal'
export const operationalUrl = (path: string) => `/t/${tenant}/l/${venue}${path}`

export async function expectHealthyPage(page: Page, label: string) {
  await expect(page.locator('body'), `${label}: la página no debe quedar vacía`).not.toBeEmpty()
  await expect(
    page.getByText(/Something went wrong|No se ha podido cargar esta pantalla/i),
    `${label}: no debe mostrar error boundary`,
  ).toHaveCount(0)
}

export async function openOperationalPage(page: Page, path: string, label: string) {
  await page.goto(operationalUrl(path), { waitUntil: 'commit' })
  // TanStack Start streams the shell before the lazy route hydrates. Give the
  // client a deterministic hydration point before interacting with controls.
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(500)
  await page.locator('body').waitFor({ state: 'visible' })
  await expectHealthyPage(page, label)
  await expect(
    page.locator('main[aria-busy="true"]'),
    `${label}: la pantalla no debe quedarse en estado de carga`,
  ).toHaveCount(0, { timeout: 15000 })
}

export async function expectFeedback(page: Page, label: string) {
  await expect(
    page.locator('[aria-live="polite"], [role="status"], [role="alert"]'),
    `${label}: falta feedback accesible`,
  ).toHaveCount(1, { timeout: 5000 })
}
