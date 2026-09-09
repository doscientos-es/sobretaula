import { describe, expect, it } from 'vitest'

import { getTenantVerifactuHealth } from './platform-tenant-verifactu'

describe('getTenantVerifactuHealth', () => {
  const now = new Date('2026-09-09T12:00:00.000Z')

  it('marks a fully configured test tenant as ready', () => {
    expect(
      getTenantVerifactuHealth(
        {
          certificateConfigured: false,
          certificateExpiresAt: null,
          environment: 'test',
          fiscalConfigured: true,
          invoiceSeriesCount: 1,
          outboxErrorCount: 0,
        },
        now,
      ).ready,
    ).toBe(true)
  })

  it('keeps production blocked and surfaces an expired certificate', () => {
    const health = getTenantVerifactuHealth(
      {
        certificateConfigured: true,
        certificateExpiresAt: '2026-09-09T11:00:00.000Z',
        environment: 'prod',
        fiscalConfigured: true,
        invoiceSeriesCount: 1,
        outboxErrorCount: 0,
      },
      now,
    )
    expect(health.ready).toBe(false)
    expect(health.items.filter((item) => !item.ok).map((item) => item.label)).toEqual([
      'Certificado válido',
      'Producción habilitada',
    ])
  })
})
