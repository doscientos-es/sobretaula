import { describe, expect, it } from 'vitest'

import { registrationInput } from './registration'

describe('registration input', () => {
  it('normalizes the owner email before creating an account', () => {
    const input = registrationInput.parse({
      displayName: 'María García',
      email: ' MARIA@EXAMPLE.COM ',
      password: 'contraseña-segura',
    })
    expect(input.email).toBe('maria@example.com')
  })

  it('requires a sufficiently long owner password', () => {
    expect(
      registrationInput.safeParse({
        displayName: 'María García',
        email: 'maria@example.com',
        password: 'corta',
      }).success,
    ).toBe(false)
  })
})
