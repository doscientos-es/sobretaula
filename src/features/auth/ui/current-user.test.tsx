import { describe, expect, it } from 'vitest'

import { userInitials } from './current-user'

describe('userInitials', () => {
  it('uses the first and last initials of a display name', () => {
    expect(userInitials('María García')).toBe('MG')
  })

  it('uses two characters for an email fallback', () => {
    expect(userInitials('maria@example.test')).toBe('MA')
  })
})
