import { describe, expect, it } from 'vitest'

import { buildTipsCsv } from './tips-export'

describe('buildTipsCsv', () => {
  it('emits a versioned stable export and escapes notes', () => {
    const csv = buildTipsCsv(
      [
        {
          amountCents: 1250,
          createdAt: '2026-09-14T20:00:00.000Z',
          date: '2026-09-14',
          id: 'tip-1',
          note: 'Caja, ajuste',
          paidAt: null,
          recordedBy: 'Ana',
        },
      ],
      { exportedAt: '2026-09-14T21:00:00.000Z', timezone: 'Europe/Madrid' },
    )
    expect(csv).toContain('schema_version,exportado_en,zona_horaria')
    expect(csv).toContain('1,2026-09-14T21:00:00.000Z,Europe/Madrid')
    expect(csv).toContain('"Caja, ajuste"')
  })
})
