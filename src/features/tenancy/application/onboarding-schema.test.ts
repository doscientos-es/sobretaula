import { describe, expect, it } from 'vitest'

import { tenantOnboardingInput, tenantSlugCandidate } from './onboarding-schema'

describe('tenant onboarding input', () => {
  const validInput = {
    addressLine: 'Calle Mayor 1',
    city: 'Valencia',
    defaultLocale: 'es' as const,
    email: 'hola@example.com',
    legalName: 'Restaurante Example SL',
    name: 'Restaurante Example',
    postalCode: '46001',
    slug: 'restaurante-example',
    taxId: 'B12345674',
    timezone: 'Europe/Madrid',
  }

  it('normalizes a restaurant name into a URL-safe slug candidate', () => {
    expect(tenantSlugCandidate('  Café de l’Àvia  ')).toBe('cafe-de-l-avia')
  })

  it('turns a short restaurant name into a slug the server accepts', () => {
    expect(tenantSlugCandidate('El')).toBe('restaurante-el')
  })

  it('rejects slugs that cannot be used as a tenant URL', () => {
    expect(
      tenantOnboardingInput.safeParse({
        ...validInput,
        slug: 'No valido',
      }).success,
    ).toBe(false)
  })

  it('normalizes a valid fiscal identifier and rejects an invalid checksum', () => {
    expect(tenantOnboardingInput.parse({ ...validInput, taxId: ' b-12345674 ' }).taxId).toBe(
      'B12345674',
    )
    expect(tenantOnboardingInput.safeParse({ ...validInput, taxId: 'B12345678' }).success).toBe(
      false,
    )
  })

  it('requires a five-digit Spanish postal code', () => {
    expect(tenantOnboardingInput.safeParse({ ...validInput, postalCode: '4600' }).success).toBe(
      false,
    )
  })
})
