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

test.describe('authenticated restaurant smoke', () => {
  test.skip(
    !process.env.E2E_STORAGE_STATE,
    'Requires E2E_STORAGE_STATE from a non-production test account',
  )

  test.use({ storageState: process.env.E2E_STORAGE_STATE })

  test('tenant home does not render an error boundary', async ({ page }) => {
    const slug = process.env.E2E_TENANT_SLUG ?? 'la-fonda-demo'
    await page.goto(`/t/${slug}`)
    await expect(page.getByText('No se ha podido cargar esta pantalla')).toHaveCount(0)
    await expect(page.locator('body')).not.toBeEmpty()
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
  })
})
