import { afterEach, describe, expect, it, vi } from 'vitest'

import { readEnv } from './create-server-client'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('readEnv', () => {
  it('uses the build-time fallback when runtime aliases are absent', () => {
    vi.stubEnv('SUPABASE_URL', '')

    expect(readEnv('SUPABASE_URL', undefined, 'https://fallback.example.supabase.co')).toBe(
      'https://fallback.example.supabase.co',
    )
  })
})
