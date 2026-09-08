import { describe, expect, it } from 'vitest'

import { createTranslator, translate } from './messages'

describe('translate', () => {
  it('returns the message for each shipped locale', () => {
    expect(translate('es', 'nav.reservations')).toBe('Reservas')
    expect(translate('ca', 'nav.reservations')).toBe('Reserves')
  })

  it('exposes a bound translator per locale', () => {
    const t = createTranslator('ca')
    expect(t('nav.invoices')).toBe('Factures')
  })
})
