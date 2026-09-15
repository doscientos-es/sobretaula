import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { buildPlatformFiscalInvoicePdf, sha256 } from './platform-fiscal-invoice-pdf'

describe('platform fiscal invoice PDF', () => {
  it('generates a readable one-page PDF and a content hash', async () => {
    const pdf = await buildPlatformFiscalInvoicePdf({
      customerAddressLine: 'Carrer de la Prova, 1',
      customerCity: 'Barcelona',
      customerName: 'Restaurant de Prova',
      customerNif: 'B12345678',
      customerPostalCode: '08001',
      fullNumber: 'ST-2026-0001',
      issuedAt: '2026-09-15T10:00:00.000Z',
      issuerAddressLine: 'Carrer de SobreTaula, 1',
      issuerCity: 'Barcelona',
      issuerLegalName: 'SobreTaula S.L.',
      issuerNif: 'B87654321',
      issuerPostalCode: '08002',
      lines: [
        {
          description: 'Suscripción mensual',
          quantity: 1,
          subtotal_cents: 2999,
          vat_rate_bps: 2100,
        },
      ],
      paidAt: '2026-09-15T10:01:00.000Z',
      paymentStatus: 'paid',
      periodEnd: '2026-10-14',
      periodStart: '2026-09-15',
      subtotalCents: 2999,
      totalCents: 3629,
      vatCents: 630,
      vatRateBps: 2100,
    })

    const loaded = await PDFDocument.load(pdf)
    expect(loaded.getPageCount()).toBe(1)
    expect(pdf.byteLength).toBeGreaterThan(500)
    expect(sha256(pdf)).toMatch(/^[a-f0-9]{64}$/)
  })
})
