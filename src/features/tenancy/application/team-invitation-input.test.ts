import { describe, expect, it } from 'vitest'

import { teamInvitationFormError, teamInvitationFormInput } from './team-invitation-input'

describe('team invitation form input', () => {
  const valid = { email: 'ana@example.com', name: 'Ana García', role: 'waiter' }

  it('allows an existing account to be added without a redundant name', () => {
    expect(teamInvitationFormInput.parse({ ...valid, name: '' }).name).toBeUndefined()
  })

  it('explains the exact invalid field before submitting', () => {
    expect(teamInvitationFormError({ ...valid, email: '' })).toBe(
      'Indica el correo del trabajador.',
    )
    expect(teamInvitationFormError({ ...valid, email: 'ana' })).toBe(
      'Escribe un correo válido, por ejemplo nombre@restaurante.com.',
    )
    expect(teamInvitationFormError({ ...valid, name: 'A' })).toBe(
      'El nombre debe tener al menos 2 caracteres.',
    )
  })
})
