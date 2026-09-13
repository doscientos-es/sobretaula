import { describe, expect, it } from 'vitest'

import { teamErrorMessage, teamInvitationSuccessMessage } from './team-error'

describe('teamInvitationSuccessMessage', () => {
  it('distinguishes an existing account from an email invitation', () => {
    expect(teamInvitationSuccessMessage('member_added')).toBe(
      'La cuenta ya existía y se ha añadido al equipo.',
    )
    expect(teamInvitationSuccessMessage('invitation_sent')).toBe(
      'Invitación enviada. La persona deberá revisar su correo.',
    )
  })
})

describe('teamErrorMessage', () => {
  it('keeps authentication recovery when the server response is serialized', () => {
    expect(teamErrorMessage({ status: 401 })).toBe(
      'Tu sesión ha caducado. Inicia sesión de nuevo e inténtalo de nuevo.',
    )
  })

  it('explains serialized permission and input-validation failures', () => {
    expect(teamErrorMessage({ message: 'Forbidden', status: 403 })).toBe(
      'No tienes permisos para añadir este rol.',
    )
    expect(teamErrorMessage({ message: 'ZodError: invalid_type' })).toBe(
      'Revisa el nombre, el correo y el rol del trabajador antes de añadirlo.',
    )
  })

  it('preserves known invitation failures without exposing server details', () => {
    expect(teamErrorMessage({ message: 'tenant_invitation_delivery_failed' })).toBe(
      'No se pudo enviar la invitación. Comprueba el correo e inténtalo de nuevo.',
    )
  })

  it('explains when a new worker needs a name for their invitation', () => {
    expect(teamErrorMessage({ message: 'tenant_invitation_name_required', status: 422 })).toBe(
      'No existe una cuenta con ese correo. Indica su nombre para enviarle una invitación.',
    )
  })
})
