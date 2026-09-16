import path from 'node:path'

import { test, expect } from '@playwright/test'

test('public reservation page renders the published booking flow', async ({ page }) => {
  await page.goto('/reservar/la-fonda-demo')
  await expect(page.getByRole('heading', { name: 'La Fonda Demo' })).toBeVisible()
  await expect(page.locator('#public-service option:not([value=""])')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Reservar mesa' })).toBeVisible()
})

test('tokenized reservation management is never cacheable', async ({ request }) => {
  const response = await request.get(
    '/reserva/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  )
  expect(response.headers()['cache-control']).toBe('no-store')
})

test('invalid reservation link shows an actionable empty state', async ({ page }) => {
  await page.goto('/reserva/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  await expect(page.getByRole('heading', { name: 'Reserva no encontrada' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
})

test('team invitation requires authentication before showing the accept action', async ({
  browser,
}, testInfo) => {
  testInfo.skip(testInfo.project.name !== 'public', 'security boundary belongs to public project')
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await page.goto(`/invitacion?token=${'a'.repeat(40)}`)
  await expect(page).toHaveURL(/\/login/)
  await context.close()
})

test('platform invitation requires authentication before showing the accept action', async ({
  browser,
}, testInfo) => {
  testInfo.skip(testInfo.project.name !== 'public', 'security boundary belongs to public project')
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await page.goto(`/admin/invitacion?token=${'b'.repeat(40)}`)
  await expect(page).toHaveURL(/\/login/)
  await context.close()
})

test('public reservation gives accessible feedback for incomplete guest details', async ({
  page,
}) => {
  await page.goto('/reservar/la-fonda-demo')
  await page.locator('#public-service').waitFor({ state: 'visible' })
  await page.waitForLoadState('networkidle')
  await page.locator('#public-service').selectOption({ index: 1 })
  await expect(page.locator('#public-date option:not([value=""])').first()).toBeAttached()
  await page.locator('#public-date').selectOption({ index: 1 })
  await expect(page.locator('#public-time option:not([value=""])').first()).toBeAttached()
  await page.locator('#public-time').selectOption({ index: 1 })
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check()

  await page.getByRole('button', { name: 'Reservar mesa' }).click()

  await expect(page.locator('[role="alert"], [aria-live="assertive"]')).toContainText(
    /datos|nombre|email|completa/i,
  )
})

test.describe('authenticated restaurant smoke', () => {
  test.skip(
    !process.env.E2E_STORAGE_STATE,
    'Requires E2E_STORAGE_STATE from a non-production test account',
  )

  test.use({ storageState: process.env.E2E_STORAGE_STATE })

  test('tenant home does not render an error boundary', async ({ page }) => {
    const slug = process.env.E2E_TENANT_SLUG ?? 'la-fonda-demo'
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const sourceUrl = message.location().url
        if (!sourceUrl.includes('@tanstack-start/styles.css'))
          runtimeErrors.push(`${message.text()} @ ${sourceUrl}`)
      }
    })
    page.on('response', (response) => {
      if (response.status() === 404 && !response.url().includes('@tanstack-start/styles.css'))
        runtimeErrors.push(`HTTP 404 @ ${response.url()}`)
    })
    await page.goto(`/t/${slug}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('No se ha podido cargar esta pantalla')).toHaveCount(0)
    await expect(page.locator('body')).not.toBeEmpty()
    expect(runtimeErrors, 'tenant home no debe emitir errores de runtime').toEqual([])
  })

  test('public menu renders the published catalog', async ({ page }) => {
    await page.goto('/menu/la-fonda-demo')
    await expect(page.getByText('Carta', { exact: true })).toBeVisible()
    await expect(page.getByText('No se ha podido cargar esta pantalla')).toHaveCount(0)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('public menu allows adding and removing a unit from the order', async ({ page }) => {
    await page.goto('/menu/la-fonda-demo')
    await expect(page.getByText('Tu pedido · 0.00 €')).toBeVisible()
    await page.waitForLoadState('networkidle')
    const addButton = page.getByRole('button', { name: 'Añadir al pedido' }).first()
    await expect(addButton).toBeVisible()
    await addButton.click()
    await expect(page.getByText(/1 ×/).first()).toBeVisible()
    const removeButton = page.getByRole('button', { name: /Quitar una unidad de/ }).first()
    await removeButton.click()
    await expect(page.getByText('Añade platos para empezar.')).toBeVisible()
  })

  for (const path of [
    '/t/la-fonda-demo',
    '/t/la-fonda-demo/l/principal/tpv',
    '/t/la-fonda-demo/l/principal/plano',
    '/t/la-fonda-demo/l/principal/servicio',
    '/t/la-fonda-demo/l/principal/reservas',
    '/t/la-fonda-demo/l/principal/bloques',
    '/t/la-fonda-demo/l/principal/caja',
    '/t/la-fonda-demo/l/principal/clientes',
    '/t/la-fonda-demo/l/principal/comunicaciones',
    '/t/la-fonda-demo/l/principal/fichaje',
    '/t/la-fonda-demo/l/principal/fichaje-terminal',
    '/t/la-fonda-demo/l/principal/informes',
    '/t/la-fonda-demo/l/principal/productos',
    '/t/la-fonda-demo/l/principal/documentos-compras',
    '/t/la-fonda-demo/l/principal/pedidos-online',
    '/t/la-fonda-demo/l/principal/propinas',
    '/t/la-fonda-demo/l/principal/fidelizacion',
    '/t/la-fonda-demo/l/principal/tarjetas-regalo',
    '/t/la-fonda-demo/facturacion',
    '/t/la-fonda-demo/facturas',
    '/t/la-fonda-demo/comunicaciones',
    '/t/la-fonda-demo/equipo',
    '/t/la-fonda-demo/ajustes',
    '/t/la-fonda-demo/suscripcion/facturas',
  ]) {
    test(`${path} does not render an error boundary`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByText('Something went wrong!')).toHaveCount(0)
      await expect(page.getByText('No se ha podido cargar esta pantalla')).toHaveCount(0)
      await expect(page.locator('body')).not.toContainText(/"venueId"/)
      await expect(page.getByRole('button', { name: /hide error/i })).toHaveCount(0)
      await expect(page.locator('body')).not.toBeEmpty()
    })
  }

  test('mobile navigation exposes an accessible menu trigger', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/t/la-fonda-demo')
    const menuButton = page.getByRole('button', { name: /abrir menú de navegación/i })
    await expect(menuButton).toBeVisible()
    await menuButton.focus()
    await expect(menuButton).toBeFocused()
  })

  test('desktop navigation uses the persistent sidebar without a menu trigger', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/t/la-fonda-demo')
    await expect(page.locator('[data-slot="app-shell-sidebar"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /abrir menú de navegación/i })).toBeHidden()
  })

  test('product screen exposes inventory and recipe context', async ({ page }) => {
    await page.goto('/t/la-fonda-demo/l/principal/productos')
    await expect(page.getByText('Ingredientes e inventario', { exact: true })).toBeVisible()
    await expect(page.getByText(/stock actual/i)).toBeVisible()
    await page.getByLabel('Buscar ingrediente').fill('no-existe-e2e-xyz')
    await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible()
  })

  test('online orders exposes a stable empty state when there are no orders', async ({ page }) => {
    await page.goto('/t/la-fonda-demo/l/principal/pedidos-online')
    await expect(page.getByRole('heading', { name: 'Pedidos online', exact: true })).toBeVisible()
    await expect(
      page.getByText('No hay pedidos en este estado.', { exact: true }).first(),
    ).toBeVisible()
  })

  test('guest directory recovers from a search with no matches', async ({ page }) => {
    await page.goto('/t/la-fonda-demo/l/principal/clientes')
    await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')
    const search = page.getByLabel('Buscar clientes')
    await search.fill(`no-existe-e2e-${Date.now()}`)
    await expect(page.getByText('No hay clientes que coincidan.', { exact: true })).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click()
    await expect(search).toHaveValue('')
    await expect(page.getByText('No hay clientes que coincidan.', { exact: true })).toBeHidden()
  })

  test('sales report explains an invalid date range', async ({ page }) => {
    await page.goto('/t/la-fonda-demo/l/principal/informes')
    await expect(
      page.getByRole('heading', { name: 'Informes de ventas', exact: true }),
    ).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.locator('#report-from').fill('2026-09-20')
    await page.locator('#report-to').fill('2026-09-19')
    await page.getByRole('button', { name: 'Actualizar', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Selecciona un rango válido')
  })

  test('scheduling blocks explains an invalid time range without creating a block', async ({
    page,
  }) => {
    await page.goto('/t/la-fonda-demo/l/principal/bloques')
    await expect(
      page.getByRole('heading', { name: 'Bloques y cierres', exact: true }),
    ).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Título').fill('Cierre inválido E2E')
    await page.getByLabel('Inicio').fill('2026-09-20T10:00')
    await page.getByLabel('Fin').fill('2026-09-20T09:00')
    await page.getByRole('button', { name: 'Crear bloqueo', exact: true }).click()
    await expect(
      page.getByText('La fecha de fin debe ser posterior al inicio.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Cierre inválido E2E', { exact: true })).toHaveCount(0)
  })

  test('campaigns empty state guides the first campaign creation', async ({ page }) => {
    await page.goto('/t/la-fonda-demo/l/principal/comunicaciones')
    await expect(page.getByText('Nueva campaña', { exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Todavía no hay campañas.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Crear primera campaña', exact: true }).click()
    await expect(page.locator('#campaign-name')).toBeFocused()
  })

  test('team search recovers from no matches', async ({ page }) => {
    const unlabeledControlWarnings: string[] = []
    page.on('console', (message) => {
      if (
        message.type() === 'warning' &&
        message.text().includes('If you do not provide a visible label')
      ) {
        unlabeledControlWarnings.push(`${message.text()} @ ${message.location().url}`)
      }
    })
    await page.goto('/t/la-fonda-demo/equipo')
    await expect(page.getByText('Personas con acceso', { exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')
    const search = page.getByLabel('Buscar en el equipo')
    await search.fill(`no-existe-equipo-e2e-${Date.now()}`)
    await expect(
      page.getByText('No hay personas que coincidan con la búsqueda.', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click()
    await expect(search).toHaveValue('')
    expect(unlabeledControlWarnings, 'No deben quedar controles sin nombre accesible').toEqual([])
  })

  test('team invitation lifecycle accepts, assigns every role and removes access', async ({
    browser,
    page,
  }) => {
    const lifecycleContext = await browser.newContext({
      storageState: path.resolve('e2e/.auth/waiter.json'),
    })
    const lifecyclePage = await lifecycleContext.newPage()
    await lifecyclePage.goto('/invitacion?token=e2e-team-invitation-token-2026-000000000')
    await lifecyclePage.waitForLoadState('networkidle')
    await lifecyclePage.getByRole('button', { name: 'Aceptar invitación' }).click()
    await lifecyclePage.waitForTimeout(5000)
    if (new URL(lifecyclePage.url()).pathname === '/invitacion') {
      throw new Error(`La aceptación falló: ${await lifecyclePage.locator('body').innerText()}`)
    }
    await expect(lifecyclePage).toHaveURL(/\/t\/la-fonda-demo/)
    await lifecycleContext.close()

    await page.goto('/t/la-fonda-demo/equipo')
    await expect(page.getByText('Personas con acceso', { exact: true })).toBeVisible()
    const lifecycleEmail = process.env.E2E_WAITER_EMAIL ?? 'e2e-waiter@example.test'
    const roles = [
      ['manager', 'Gerente'],
      ['host', 'Jefe de sala'],
      ['waiter', 'Camarero'],
      ['accountant', 'Administración'],
    ] as const
    for (const [, roleLabel] of roles) {
      await page.getByRole('button', { name: 'Camarero', exact: true }).click()
      await page.getByRole('option', { name: roleLabel, exact: true }).click()
      await page.getByLabel('Correo').fill(lifecycleEmail)
      await page.getByRole('button', { name: 'Añadir', exact: true }).click()
      await expect(page.getByText('La cuenta ya existía y se ha añadido al equipo.')).toBeVisible()
    }

    await expect(page.getByText('E2E Team Lifecycle', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Eliminar acceso', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
    await expect(page.getByText('Acceso eliminado del restaurante.')).toBeVisible()
    await page.getByRole('button', { name: 'Camarero', exact: true }).click()
    await page.getByRole('option', { name: 'Camarero', exact: true }).click()
    await page.getByLabel('Correo').fill(lifecycleEmail)
    await page.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect(page.getByText('La cuenta ya existía y se ha añadido al equipo.')).toBeVisible()
  })
})
