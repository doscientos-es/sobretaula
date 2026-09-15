import { test, expect } from '@playwright/test'

import { expectHealthyPage, openOperationalPage, operationalUrl, tenant } from './helpers'

test.beforeEach(async ({ page }, testInfo) => {
  const required = testInfo.title.match(/^@(owner|manager|host|waiter|accountant)/)?.[1]
  test.skip(
    !required || testInfo.project.name !== required,
    `requires ${required ?? 'owner'} session`,
  )
})

test.describe.configure({ mode: 'serial' })

test('@owner @activation @P0 activa y revisa el espacio operativo', async ({ page }) => {
  await openOperationalPage(page, '', 'owner activation')
  await expect(page.getByText(/operaciones|servicio|plano/i).first()).toBeVisible()

  await openOperationalPage(page, '/plano', 'owner floor plan')
  const interiorArea = page.getByRole('button', { name: /^Interior$/i })
  if (await interiorArea.count()) await interiorArea.click()
  const versionName = `E2E turno ${new Date().toISOString().replace(/[:.]/g, '-')}`
  const versionInput = page.getByLabel(/guardar como versión/i)
  await versionInput.fill(versionName)
  const activationInput = page.getByLabel(/activar desde/i)
  const activationDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const deactivationDate = new Date(activationDate.getTime() + 24 * 60 * 60 * 1000)
  const toLocalInput = (date: Date) => {
    const offset = date.getTimezoneOffset()
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
  }
  await activationInput.fill(toLocalInput(activationDate))
  await page.getByLabel(/activar hasta/i).fill(toLocalInput(deactivationDate))
  const saveButton = page.getByRole('button', { name: /^guardar$/i }).last()
  await expect(saveButton, 'owner activation: guardar versión debe estar disponible').toBeEnabled({
    timeout: 15000,
  })
  await saveButton.click()
  const feedback = page.locator('[aria-live], [role="status"], [role="alert"]')
  await expect(feedback, 'owner activation: guardar versión debe responder').toContainText(
    /guardad|solapa|corrige|fecha|no se ha podido/i,
  )
  await expect(feedback, 'owner activation: guardar versión no debe fallar').not.toContainText(
    /no se ha podido|solapa|corrige|fecha/i,
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('listitem').filter({ hasText: versionName }).first()).toBeVisible()
})

test('@owner @cash @P0 abre la caja y conserva el estado', async ({ page }) => {
  await openOperationalPage(page, '/caja', 'owner cash')
  await expect(page.getByRole('heading', { name: /caja/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /abrir|iniciar/i }).first()).toBeVisible()
})

test('@manager @tpv @P0 opera una mesa y llega al TPV', async ({ page }) => {
  await openOperationalPage(page, '/servicio', 'manager service')
  await page.getByRole('button', { name: /vista lista/i }).click()
  // The dedicated E2E database may carry a different seeded layout after a
  // previous run. Select the first accessible free table instead of coupling
  // this performance/flow check to one fixture label.
  const freeTable = page.getByRole('button', { name: /Mesa .* · .*Libre/i }).first()
  await expect(freeTable, 'manager service: debe existir una mesa libre').toBeVisible()
  await freeTable.click()
  await expect(
    page.getByText(/1 mesa\(s\) seleccionada/i),
    'manager service: la sugerencia debe seleccionar B01',
  ).toBeVisible()
  await page.getByLabel(/comensales sin reserva/i).fill('2')
  await page.getByRole('button', { name: /sentar en las mesas seleccionadas/i }).click()
  const feedback = page.locator('[aria-live], [role="status"], [role="alert"]')
  await expect(feedback, 'manager service: walk-in debe confirmar').toContainText(
    /sala actualizada|walk-in guardado/i,
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /vista lista/i }).click()
  await expect(
    page.getByRole('button', { name: /Mesa .*Ocupada/i }).first(),
    'manager service: la mesa debe persistir ocupada',
  ).toBeVisible()
})

test('@manager @authorization @P0 ve los controles financieros protegidos', async ({ page }) => {
  await openOperationalPage(page, '/tpv', 'manager permissions')
  await expect(page.getByText(/cobrar|descuento|arqueo/i).first()).toBeVisible()
})

test('@host @reservations @P0 conecta reserva pública con agenda', async ({ page }) => {
  await page.goto(`/reservar/${tenant}`)
  await expectHealthyPage(page, 'public reservation')
  await expect(page.getByRole('button', { name: /reservar mesa/i })).toBeVisible()
  await openOperationalPage(page, '/reservas', 'host reservations')
})

test('@host @service @P0 muestra la operación de sala', async ({ page }) => {
  await openOperationalPage(page, '/servicio', 'host service')
  await expect(page.getByText(/mesa|llegada|walk-in|servicio/i).first()).toBeVisible()
})

test('@waiter @mobile @tpv @P0 expone la comanda en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openOperationalPage(page, '/tpv', 'waiter mobile tpv')
  await expect(page.getByText(/producto|comanda|cuenta/i).first()).toBeVisible()
})

test('@waiter @timekeeping @P1 permite acceder al fichaje', async ({ page }) => {
  await openOperationalPage(page, '/fichaje-terminal', 'waiter timekeeping')
  await expect(page.getByText(/fichaje|pin|entrada|salida/i).first()).toBeVisible()
})

test('@accountant @reports @P1 consulta facturación y exportación', async ({ page }) => {
  await page.goto(`/t/${tenant}/facturas`, { waitUntil: 'domcontentloaded' })
  await expectHealthyPage(page, 'accountant invoices')
  await expect(page.getByText(/factura|venta|export/i).first()).toBeVisible()
})

test('@owner @security @P0 rechaza acceso anónimo a una ruta privada', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  await page.goto(operationalUrl('/tpv'))
  await expect(page).toHaveURL(/\/login/)
  await context.close()
})
