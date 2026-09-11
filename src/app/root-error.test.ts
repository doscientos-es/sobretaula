import { describe, expect, it } from 'vitest'

import { missingEnvironmentVariable } from './root-error'

describe('missingEnvironmentVariable', () => {
  it('extracts the missing variable without exposing a value', () => {
    expect(missingEnvironmentVariable(new Error('Falta la variable de entorno SESSION_PASSWORD.'))).toBe(
      'SESSION_PASSWORD',
    )
  })

  it('recognizes missing public Supabase configuration', () => {
    expect(missingEnvironmentVariable({ message: 'supabase_public_config_missing' })).toBe(
      'VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY',
    )
  })

  it('does not expose arbitrary server errors', () => {
    expect(missingEnvironmentVariable(new Error('database password is secret'))).toBeNull()
  })
})