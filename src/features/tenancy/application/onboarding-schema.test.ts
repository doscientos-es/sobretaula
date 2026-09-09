import { describe, expect, it } from 'vitest'

import { tenantOnboardingInput, tenantSlugCandidate } from './onboarding-schema'

describe('tenant onboarding input', () => {
  it('normalizes a restaurant name into a URL-safe slug candidate', () => {
    expect(tenantSlugCandidate('  Café de l’Àvia  ')).toBe('cafe-de-l-avia')
  })

  it('rejects slugs that cannot be used as a tenant URL', () => {
    expect(
      tenantOnboardingInput.safeParse({
        addressLine: 'Calle Mayor 1',
        city: 'Valencia',
        defaultLocale: 'es',
        email: 'hola@example.com',
        legalName: 'Restaurante Example SL',
        name: 'Restaurante Example',
        postalCode: '46001',
        slug: 'No valido',
        taxId: 'B12345678',
        timezone: 'Europe/Madrid',
      }).success,
    ).toBe(false)
  })
})
