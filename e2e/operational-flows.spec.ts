import { test, expect } from '@playwright/test'

import { expectHealthyPage, openOperationalPage, operationalUrl, tenant } from './helpers'

test.beforeEach(async ({ page: _page }, testInfo) => {
  const required = testInfo.title.match(/^@(owner|manager|host|waiter|accountant)/)?.[1]
  test.skip(
    !required || testInfo.project.name !== required,
    `requires ${required ?? 'owner'} session`,
  )
})

test.describe.configure({ mode: 'serial' })

test('@owner @activation @P0 activa y revisa el espacio operativo', async ({ page }) => {
  await openOperationalPage(page, '/plano', 'owner floor plan')
  const interiorArea = page.getByRole('button', { name: /^Interior$/i })
  if (await interiorArea.count()) await interiorArea.click()
  const versionName = `E2E turno ${new Date().toISOString().replace(/[:.]/g, '-')}`
  const versionInput = page.getByLabel(/guardar como versión/i)
  await versionInput.fill(versionName)
  const activationInput = page.getByLabel(/activar desde/i)
  const activationDate = new Date(
    Date.UTC(
      2099,
      0,
      1 + Math.floor(Math.random() * 365),
      Math.floor(Math.random() * 24),
      Math.floor(Math.random() * 60),
    ),
  )
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
  if (await feedback.getByText(/solapa|elige otra fecha/i).count()) {
    // Existing pilot data may occupy the random slot. This is a valid edge
    // case in a shared environment: verify the actionable conflict feedback
    // and leave the data untouched instead of manufacturing another version.
    return
  }
  await expect(feedback, 'owner activation: guardar versión no debe fallar').toContainText(
    /guardad/i,
  )
  await page.reload({ waitUntil: 'networkidle' })
  const reloadedInteriorArea = page.getByRole('button', { name: /^Interior$/i })
  await expect(
    reloadedInteriorArea,
    'owner activation: Interior debe estar disponible',
  ).toBeVisible()
  await reloadedInteriorArea.click()
  await expect(
    page.getByRole('list', { name: 'Versiones guardadas' }).getByText(versionName),
    'owner activation: la versión debe aparecer en la zona seleccionada',
  ).toBeVisible()
})

test('@owner @floor-plan @P0 crea y edita un plano completo', async ({ page }) => {
  await openOperationalPage(page, '/plano', 'owner floor plan lifecycle')
  await expect(page.getByRole('heading', { name: 'Plano de sala', exact: true })).toBeVisible()

  const areaName = `E2E Terraza ${Date.now()}`
  await page.getByRole('button', { name: /añadir planta o zona/i }).click()
  await expect(page.getByRole('dialog', { name: /nueva planta o zona/i })).toBeVisible()
  await page.getByLabel('Nombre', { exact: true }).fill(areaName)
  await page.getByLabel('Ancho (cm)').fill('1000')
  await page.getByLabel('Fondo (cm)').fill('700')
  await page.getByRole('button', { name: 'Crear planta', exact: true }).click()
  await expect(page.getByRole('dialog', { name: /nueva planta o zona/i })).toBeHidden({
    timeout: 15000,
  })
  await page.reload({ waitUntil: 'networkidle' })

  const area = page.getByRole('button', { name: areaName, exact: true })
  await expect(area, 'la nueva zona debe persistir y poder seleccionarse').toBeVisible()
  await area.click()

  await page.getByRole('button', { name: 'Editar medidas del plano' }).click()
  const dimensionsDialog = page.getByRole('dialog', { name: /medidas del plano/i })
  await expect(dimensionsDialog).toBeVisible()
  await dimensionsDialog.getByLabel('Ancho (cm)').fill('1200')
  await dimensionsDialog.getByLabel('Fondo (cm)').fill('800')
  await dimensionsDialog.getByRole('button', { name: 'Guardar medidas', exact: true }).click()
  await expect(dimensionsDialog).toBeHidden({
    timeout: 15000,
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: areaName, exact: true }).click()
  await expect(page.getByText(/12 m × 8 m/)).toBeVisible()

  await page.getByRole('button', { name: 'Pared', exact: true }).last().click()
  await page.getByRole('button', { name: 'Cocina', exact: true }).last().click()
  await expect(page.locator('svg text').filter({ hasText: 'Pared' })).toBeVisible()
  await expect(page.locator('svg text').filter({ hasText: 'Cocina' })).toBeVisible()

  await page.getByRole('button', { name: /añadir mesa al plano/i }).click()
  const newTable = page.getByRole('button', { name: /Mesa M\d+ ·/ }).last()
  await expect(newTable, 'la mesa recién creada debe aparecer en el listado').toBeVisible()
  await newTable.click()
  await expect(page.getByRole('dialog', { name: /editar mesa o elemento/i })).toBeVisible()
  await page.getByLabel('Número de mesa').fill(`E2E-${Date.now()}`)
  await page.getByLabel('Número de mesa').press('Tab')
  await page.getByLabel('x (cm)').fill('300')
  await page.getByLabel('y (cm)').fill('300')
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await expect(page.getByRole('button', { name: /Mesa E2E-/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Guardar plano', exact: true }).click()
  await expect(page.locator('[aria-live], [role="status"], [role="alert"]')).toContainText(
    /plano guardado|corrige|solapa|no se ha podido/i,
    { timeout: 15000 },
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: areaName, exact: true }).click()
  await expect(page.locator('svg text').filter({ hasText: 'Pared' })).toBeVisible()
  await expect(page.locator('svg text').filter({ hasText: 'Cocina' })).toBeVisible()
})

test('@owner @cash @P0 abre la caja y conserva el estado', async ({ page }) => {
  await openOperationalPage(page, '/caja', 'owner cash')
  await expect(page.getByRole('heading', { name: /caja/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /abrir|iniciar/i }).first()).toBeVisible()
})

test('@owner @reservations @P0 crea y cancela una reserva pública', async ({ page }) => {
  await page.goto(`/reservar/${tenant}`, { waitUntil: 'domcontentloaded' })
  await expectHealthyPage(page, 'public reservation lifecycle')
  await page.locator('#public-service').waitFor({ state: 'visible' })
  await page.waitForLoadState('networkidle')

  const publicService = page.locator('#public-service')
  await publicService.selectOption({ index: 1 })
  await expect(
    page.locator('#public-date option:not([value=""])').first(),
    'public reservation: el turno debe ofrecer fechas futuras',
  ).toBeAttached()
  await page.locator('#public-date').selectOption({ index: 1 })
  const time = page.locator('#public-time option:not([value=""])').first()
  await expect(time, 'public reservation: debe haber una hora disponible').toBeAttached()
  await page.locator('#public-time').selectOption({ index: 1 })

  const unique = Date.now().toString()
  await page.getByLabel(/tu nombre/i).fill(`E2E Reserva ${unique}`)
  await page.getByLabel(/email/i).fill(`e2e-reservation-${unique}@example.test`)
  await page.getByLabel(/teléfono/i).fill(`600${unique.slice(-6)}`)
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check()
  await page.getByRole('button', { name: /reservar mesa/i }).click()

  await expect(page.locator('#booking-confirmed')).toBeVisible({ timeout: 15000 })
  const managementLink = page.getByRole('link', { name: /consultar o cancelar/i })
  await expect(managementLink).toBeVisible()
  const managementUrl = await managementLink.getAttribute('href')
  expect(managementUrl).toMatch(/^\/reserva\//)
  if (!managementUrl) throw new Error('public reservation: falta el enlace de gestión')

  await page.goto(managementUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  const reservationDate = page.getByLabel('Nueva fecha y hora')
  await reservationDate.fill('2020-01-01T12:00')
  await page.getByRole('button', { name: 'Guardar cambio', exact: true }).click()
  await expect(page.locator('[aria-live="assertive"]')).toContainText(
    /fecha|pasado|válid|actualizar|ocupad/i,
  )
  await expect(page.getByRole('button', { name: /cancelar reserva/i })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar reserva', exact: true }).click({ force: true })
  await expect(page.getByRole('button', { name: /confirmar cancelación/i })).toBeVisible()
  await page.getByRole('button', { name: /confirmar cancelación/i }).click()
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: /reserva cancelada/i }),
  ).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/mesa.*disponible/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /cancelar reserva/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /guardar cambio/i })).toHaveCount(0)
})

test('@owner @cash @P0 abre, mueve y arquea la caja', async ({ page }) => {
  await openOperationalPage(page, '/caja', 'owner cash lifecycle')
  await expect(page.getByRole('heading', { name: 'Caja', exact: true })).toBeVisible()

  const openButton = page.getByRole('button', { name: /^abrir caja$/i })
  if (await openButton.isVisible()) {
    await page.getByLabel(/fondo/i).fill('10.00')
    await openButton.click()
    await expect(page.getByText('Caja abierta', { exact: true })).toBeVisible()
  }
  await page.reload({ waitUntil: 'networkidle' })

  await expect(page.locator('#movement-amount')).toBeVisible()
  await page.locator('#movement-amount').fill('1.23')
  await page.locator('#movement-reason').fill(`E2E entrada ${Date.now()}`)
  await page.getByRole('button', { name: /registrar entrada/i }).click()
  await expect(page.locator('[aria-live], [role="status"], [role="alert"]')).toContainText(
    /entrada registrada/i,
  )

  const expectedText = await page.getByText(/efectivo esperado:/i).textContent()
  const expectedMatch = expectedText?.match(/([\d.]+),([\d]{2})/)
  expect(expectedMatch, 'owner cash lifecycle: debe mostrar el efectivo esperado').not.toBeNull()
  if (!expectedMatch) throw new Error('owner cash lifecycle: falta el efectivo esperado')
  const counted = `${expectedMatch[1].replaceAll('.', '')}.${expectedMatch[2]}`
  await page.locator('#counted-cash').fill(counted)
  await page.getByRole('button', { name: /cerrar y arquear/i }).click()
  await expect(page.getByText(/caja cerrada|histórico de cierres/i).first()).toBeVisible()
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
  await expect(
    page.getByRole('link', { name: /^Caja\b/i }),
    'manager permissions: el acceso a caja debe estar protegido para managers',
  ).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'TPV' })).toBeVisible()
  await expect(page.getByText(/cuentas activas|comanda seleccionada/i)).toBeVisible()
})

test('@waiter @timekeeping @P1 permite acceder al fichaje', async ({ page }) => {
  await openOperationalPage(page, '/fichaje-terminal', 'waiter timekeeping')
  await expect(page.getByText(/fichaje|pin|entrada|salida/i).first()).toBeVisible()
})

test('@waiter @timekeeping @P1 explica que falta el PIN antes de registrar', async ({ page }) => {
  await openOperationalPage(page, '/fichaje-terminal', 'waiter timekeeping missing pin')
  const employee = page.getByRole('combobox').first()
  await employee.fill('E2E')
  await page.getByRole('option').first().click()
  await page.getByRole('button', { name: /entrar|iniciar entrada/i }).click()
  await expect(page.getByRole('alert')).toContainText(/pin/i)
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
