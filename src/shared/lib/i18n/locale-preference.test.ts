import { describe, expect, it } from 'vitest'

import { resolveLocalePreference } from './locale-preference'

describe('resolveLocalePreference', () => {
  it('prioritizes a stored preference over the browser language', () => {
    expect(
      resolveLocalePreference({
        browserDefault: true,
        browserLanguage: 'ca-ES',
        defaultLocale: 'es',
        storedLocale: 'es-ES',
      }),
    ).toBe('es')
  })

  it('uses the tenant default when browser detection is disabled', () => {
    expect(
      resolveLocalePreference({
        browserDefault: false,
        browserLanguage: 'es-ES',
        defaultLocale: 'ca',
      }),
    ).toBe('ca')
  })
})
