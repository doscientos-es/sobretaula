import { describe, expect, it } from 'vitest'

import { describeTipAuditEvent, distributeTips } from './tips'

describe('tip audit history', () => {
  it('distinguishes saved totals, adjustments and closed periods', () => {
    expect(
      describeTipAuditEvent({
        eventType: 'daily_total_saved',
        fromDate: null,
        tipDate: '2026-09-13',
        toDate: null,
      }),
    ).toBe('Registró el cierre del día 2026-09-13')
    expect(
      describeTipAuditEvent({
        eventType: 'daily_total_updated',
        fromDate: null,
        tipDate: '2026-09-13',
        toDate: null,
      }),
    ).toBe('Actualizó el cierre del día 2026-09-13')
    expect(
      describeTipAuditEvent({
        eventType: 'period_closed',
        fromDate: '2026-09-01',
        tipDate: null,
        toDate: '2026-09-07',
      }),
    ).toBe('Cerró el período 2026-09-01 — 2026-09-07')
  })

  it('keeps the full total when distributing by worked time', () => {
    expect(
      distributeTips(5, [
        { displayName: 'Ana', employeeId: 'a', minutes: 1 },
        { displayName: 'Bruno', employeeId: 'b', minutes: 2 },
      ]).reduce((total, row) => total + row.amountCents, 0),
    ).toBe(5)
  })
})
