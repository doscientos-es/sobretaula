import { describe, expect, it } from 'vitest'

import { loginInput } from './authentication'

describe('login input', () => {
  it('normalizes a pasted email before authenticating', () => {
    const input = loginInput.parse({
      email: '  EQUIPO@RESTAURANTE.COM ',
      password: 'contraseña-segura',
    })

    expect(input.email).toBe('equipo@restaurante.com')
    expect(input.rememberSession).toBe(false)
  })

  it('accepts the optional persistent-session preference', () => {
    const input = loginInput.parse({
      email: 'equipo@restaurante.com',
      password: 'contraseña-segura',
      rememberSession: true,
    })

    expect(input.rememberSession).toBe(true)
  })

  it('rejects credentials outside the permitted limits', () => {
    expect(loginInput.safeParse({ email: 'not-an-email', password: '' }).success).toBe(false)
    expect(
      loginInput.safeParse({ email: 'equipo@restaurante.com', password: 'a'.repeat(257) }).success,
    ).toBe(false)
  })
})
