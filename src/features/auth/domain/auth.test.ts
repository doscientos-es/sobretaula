import { describe, expect, it } from 'vitest'

import { isSafeInternalRedirect } from './auth'

describe('isSafeInternalRedirect', () => {
  it('accepts application-relative paths', () => {
    expect(isSafeInternalRedirect('/t/can-pere')).toBe(true)
  })

  it.each(['https://evil.example', '//evil.example', '', undefined])(
    'rejects unsafe redirect %s',
    (value) => {
      expect(isSafeInternalRedirect(value)).toBe(false)
    },
  )
})
