import { describe, expect, it } from 'vitest'

import { indexProfilesByUserId } from './profile-index'

describe('indexProfilesByUserId', () => {
  it('retrieves the matching profile without depending on a PostgREST relationship', () => {
    const profiles = indexProfilesByUserId([
      { display_name: 'Ada', email: 'ada@example.test', user_id: 'user-1' },
    ])

    expect(profiles.get('user-1')).toMatchObject({ display_name: 'Ada' })
    expect(profiles.get('user-2')).toBeUndefined()
  })
})