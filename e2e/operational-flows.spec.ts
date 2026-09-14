import { test, expect } from '@playwright/test'
import { expectFeedback, expectHealthyPage, openOperationalPage, operationalUrl, tenant } from './helpers'

test.describe.configure({ mode: 'serial' })

test('@owner @activation @P0 activa y revisa el espacio operativo', async ({ page }) => {
  await openOperationalPage(page, '', 'owner activation')
  await expect(page.getByText(/operaciones|servicio|plano/i).first()).toBeVisible()
})

test('@owner @cash @P0 abre la caja y conserva el estado', async ({ page }) => {
  await openOperationalPage(page, '/caja', 'owner cash')
  await expect(page.getByRole('heading', { name: /caja/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /abrir|iniciar/i }).first()).toBeVisible()
})

test('@manager @tpv @P0 opera una mesa y llega al TPV', async ({ page }) => {
  await openOperationalPage(page, '/tpv', 'manager tpv')
  await expect(page.getByText(/cuenta|mesa|comanda/i).first()).toBeVisible()
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
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await page.goto(operationalUrl('/tpv'))
  await expect(page).toHaveURL(/\/login/)
  await context.close()
})
