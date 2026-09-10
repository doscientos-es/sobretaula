import { describe, expect, it } from 'vitest'

import { upsertFiscalSettingsInput } from './invoice-schema'

const input = {
  addressLine: 'Calle Mayor 1',
  city: 'Valencia',
  countryCode: 'es',
  issuerNif: 'B12345678',
  legalName: 'Restaurante SL',
  postalCode: '46001',
  tenantId: '00000000-0000-4000-8000-000000000000',
}

describe('upsertFiscalSettingsInput', () => {
  it('does not accept a user-selected VeriFactu environment', () => {
    expect(upsertFiscalSettingsInput.parse(input)).toMatchObject({
      countryCode: 'es',
    })
    expect(upsertFiscalSettingsInput.parse({ ...input, environment: 'test' })).not.toHaveProperty(
      'environment',
    )
  })
})
