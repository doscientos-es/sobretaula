import { describe, expect, it } from 'vitest'

import { previewGuestCsv } from './guest-import'

describe('previewGuestCsv', () => {
  it('parses guest data and explicit marketing consent', () => {
    const result = previewGuestCsv(
      'nombre;telefono;email;consentimiento_marketing\nAna;600000000;ana@example.com;si\nPau;;;no',
    )
    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      { email: 'ana@example.com', fullName: 'Ana', marketingConsent: true, phone: '600000000' },
      { fullName: 'Pau', marketingConsent: false },
    ])
  })

  it('reports missing names and invalid email addresses', () => {
    const result = previewGuestCsv('nombre,email\n,missing\nCliente,no-email')
    expect(result.rows).toEqual([])
    expect(result.errors).toEqual([
      { message: 'name_required', row: 2 },
      { message: 'email_invalid', row: 3 },
    ])
  })
})
