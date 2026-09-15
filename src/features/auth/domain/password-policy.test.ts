import { describe, expect, it } from 'vitest'

import { PASSWORD_MIN_LENGTH, passwordRequirements } from './password-policy'

describe('password requirements', () => {
  it('requires the configured minimum length', () => {
    const requirements = passwordRequirements('a'.repeat(PASSWORD_MIN_LENGTH - 1))

    expect(requirements).toEqual([
      { label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`, met: false },
    ])
  })

  it('requires confirmation to match when one is supplied', () => {
    const password = 'a'.repeat(PASSWORD_MIN_LENGTH)

    expect(passwordRequirements(password, 'otra contraseña').every(({ met }) => met)).toBe(false)
    expect(passwordRequirements(password, password).every(({ met }) => met)).toBe(true)
  })
})
