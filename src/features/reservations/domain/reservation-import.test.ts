import { describe, expect, it } from 'vitest'

import { previewReservationCsv } from './reservation-import'

describe('previewReservationCsv', () => {
  it('normalizes future reservation dates and guest details', () => {
    const result = previewReservationCsv(
      'turno;fecha_hora;comensales;nombre;telefono\nComida;2030-05-10T13:30:00+02:00;4;Ana;600000000',
    )
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({
      guestName: 'Ana',
      guestPhone: '600000000',
      partySize: 4,
      serviceName: 'Comida',
    })
    expect(result.rows[0]?.startsAt).toContain('2030-05-10')
  })

  it('rejects missing columns and invalid party sizes', () => {
    expect(
      previewReservationCsv('turno,fecha_hora\nComida,2030-01-01').errors[0]?.message,
    ).toContain('missing_columns')
    expect(
      previewReservationCsv('turno,fecha_hora,comensales\nComida,bad,0').errors[0]?.message,
    ).toBe('service_datetime_and_party_size_required')
  })
})
