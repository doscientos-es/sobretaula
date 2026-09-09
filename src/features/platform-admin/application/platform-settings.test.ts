import { describe, expect, it } from 'vitest'

import { platformFiscalSettingsInput } from './platform-settings'

const settings = {
  addressLine: 'Calle Mayor 1',
  city: 'Valencia',
  countryCode: 'es',
  environment: 'prod',
  issuanceEnabled: true,
  issuerNif: 'b12345678',
  legalName: 'Doscientos SL',
  postalCode: '46001',
  seriesCode: 'st-2026',
}

describe('platformFiscalSettingsInput', () => {
  it('normalizes fiscal identifiers before saving them', () => {
    expect(platformFiscalSettingsInput.parse(settings)).toMatchObject({
      countryCode: 'ES',
      issuerNif: 'B12345678',
      seriesCode: 'ST-2026',
    })
  })

  it('accepts only the provisioned Veri*factu environments', () => {
    expect(
      platformFiscalSettingsInput.safeParse({ ...settings, environment: 'test' }).success,
    ).toBe(true)
    expect(
      platformFiscalSettingsInput.safeParse({ ...settings, environment: 'live' }).success,
    ).toBe(false)
  })
})
