import { describe, expect, it } from 'vitest'

import { reservationServiceErrorMessage } from './reservation-service-error'

describe('reservationServiceErrorMessage', () => {
  it('explains that service configuration needs a manager role', () => {
    expect(reservationServiceErrorMessage(new Response(null, { status: 403 }))).toBe(
      'Solo las personas propietarias o responsables pueden configurar turnos. Pídeles acceso o que creen el turno.',
    )
  })

  it('explains a repeated service name instead of showing a generic error', () => {
    expect(
      reservationServiceErrorMessage({ message: 'reservation_service_create_failed:23505' }),
    ).toBe('Ya existe un turno con ese nombre para ese día. Edítalo o usa otro nombre.')
  })

  it('explains when activation is required even for an owner', () => {
    expect(reservationServiceErrorMessage(new Response(null, { status: 402 }))).toBe(
      'El restaurante todavía no está activo. Completa la configuración de facturación antes de crear turnos.',
    )
  })

  it('keeps a safe fallback for unexpected failures', () => {
    expect(reservationServiceErrorMessage(new Error('network failed'))).toBe(
      'No se ha podido guardar el turno. Comprueba tu conexión e inténtalo de nuevo.',
    )
  })
})
