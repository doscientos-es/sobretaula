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
})
