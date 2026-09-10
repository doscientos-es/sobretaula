import { describe, expect, it } from 'vitest'

import { displayNameForUser, loginInput, requestPasswordResetInput } from './authentication'

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

describe('requestPasswordResetInput', () => {
  it('normalizes a pasted email before requesting the recovery link', () => {
    const input = requestPasswordResetInput.parse({ email: '  MARIA@EXAMPLE.COM ' })
    expect(input.email).toBe('maria@example.com')
  })

  it('rejects a value that is not an email', () => {
    expect(requestPasswordResetInput.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })
})

describe('displayNameForUser', () => {
  it('uses the user display name when it has been configured', () => {
    expect(displayNameForUser('maria@example.test', { display_name: ' María García ' })).toBe(
      'María García',
    )
  })

  it('falls back to email when the user has no usable display name', () => {
    expect(displayNameForUser('maria@example.test', { display_name: '  ' })).toBe(
      'maria@example.test',
    )
    expect(displayNameForUser('maria@example.test', null)).toBe('maria@example.test')
  })
})
