import { describe, expect, it } from 'vitest'

import { platformTenantProvisioningInput } from './platform-tenant-provisioning'

const validInput = {
  addressLine: 'Calle Mayor 1',
  city: 'Valencia',
  defaultLocale: 'es' as const,
  email: 'facturacion@example.com',
  legalName: 'Restaurante Example SL',
  name: 'Restaurante Example',
  ownerEmail: 'propietario@example.com',
  ownerName: 'Ana Example',
  postalCode: '46001',
  slug: 'restaurante-example',
  taxId: 'B12345678',
  timezone: 'Europe/Madrid',
}

describe('platform tenant provisioning input', () => {
  it('normalizes the owner email before secure provisioning', () => {
    expect(
      platformTenantProvisioningInput.parse({
        ...validInput,
        ownerEmail: '  PROPIETARIO@EXAMPLE.COM  ',
      }).ownerEmail,
    ).toBe('propietario@example.com')
  })

  it('requires a usable owner name', () => {
    expect(
      platformTenantProvisioningInput.safeParse({ ...validInput, ownerName: 'A' }).success,
    ).toBe(false)
  })
})
