import { describe, expect, it } from 'vitest'

import { tenantOnboardingErrorMessage } from './onboarding-error'

describe('tenant onboarding errors', () => {
  it.each([
    [401, 'Tu sesión ha caducado. Inicia sesión de nuevo para guardar el restaurante.'],
    [409, 'Esta dirección de SobreTaula ya está en uso. Elige otra diferente.'],
    [422, 'Revisa la dirección de SobreTaula y los datos de facturación antes de continuar.'],
    [503, 'El alta está temporalmente en preparación. Espera unos minutos e inténtalo de nuevo.'],
  ])('explains the expected HTTP %i provisioning failure', (status, message) => {
    expect(tenantOnboardingErrorMessage(new Response(null, { status }))).toBe(message)
  })

  it('keeps infrastructure failures generic', () => {
    expect(tenantOnboardingErrorMessage(new Error('network failed'))).toBe(
      'No se ha podido guardar el alta. Comprueba tu conexión e inténtalo de nuevo.',
    )
  })
})