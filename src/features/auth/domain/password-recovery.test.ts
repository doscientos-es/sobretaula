import { describe, expect, it } from 'vitest'

import { isPasswordRecoveryHash } from './password-recovery'

describe('isPasswordRecoveryHash', () => {
  it('recognizes a Supabase password-recovery callback', () => {
    expect(
      isPasswordRecoveryHash(
        '#access_token=access-token&refresh_token=refresh-token&type=recovery',
      ),
    ).toBe(true)
  })

  it.each([
    '',
    '#type=recovery&access_token=access-token',
    '#type=signup&access_token=access-token&refresh_token=refresh-token',
  ])('rejects a callback without a usable recovery session: %s', (hash) => {
    expect(isPasswordRecoveryHash(hash)).toBe(false)
  })
})
