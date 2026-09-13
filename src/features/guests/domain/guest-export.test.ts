import { describe, expect, it } from 'vitest'

import { buildGuestContactsCsv } from './guest-export'

describe('guest contact export', () => {
  it('keeps version, timezone and stable headers while escaping contact data', () => {
    const csv = buildGuestContactsCsv(
      [
        {
          createdAt: '2026-09-14T10:00:00.000Z',
          email: 'ana@example.com',
          id: 'guest-1',
          marketingConsent: false,
          name: 'Ana, Serra',
          phone: '+34 600 000 000',
        },
      ],
      { exportedAt: '2026-09-14T12:00:00.000Z', timezone: 'Europe/Madrid' },
    )

    expect(csv.split('\n')[1]).toBe(
      '1,2026-09-14T12:00:00.000Z,Europe/Madrid,guest-1,"Ana, Serra",ana@example.com,+34 600 000 000,false,2026-09-14T10:00:00.000Z',
    )
    expect(csv).not.toContain('alerg')
  })

  it('returns headers for an empty export', () => {
    expect(buildGuestContactsCsv([], { exportedAt: '2026-09-14T12:00:00.000Z' })).toContain(
      'schema_version,exportado_en,zona_horaria,id,nombre,email,telefono,consentimiento_marketing,creado_en',
    )
  })
})
