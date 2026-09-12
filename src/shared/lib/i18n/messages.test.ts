import { describe, expect, it } from 'vitest'

import { createTranslator, formatMessage, translate } from './messages'

describe('translate', () => {
  it('returns the message for each shipped locale', () => {
    expect(translate('es', 'nav.reservations')).toBe('Reservas')
    expect(translate('ca', 'nav.reservations')).toBe('Reserves')
  })

  it('exposes a bound translator per locale', () => {
    const t = createTranslator('ca')
    expect(t('nav.invoices')).toBe('Factures')
  })

  it('ships guidance for the full-page error state in every locale', () => {
    expect(translate('es', 'error.help.title')).toBe('Mientras tanto, puedes probar esto')
    expect(translate('ca', 'error.help.title')).toBe('Mentrestant, pots provar això')
  })

  it('interpolates dynamic values without leaking placeholders', () => {
    expect(formatMessage('es', 'dashboard.nextService', { time: '20:30' })).toBe(
      'Todo preparado para el próximo servicio a las 20:30.',
    )
    expect(formatMessage('ca', 'dashboard.expectedGuests', { count: 4 })).toBe(
      '4 comensals previstos',
    )
  })
})
