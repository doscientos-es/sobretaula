import { describe, expect, it } from 'vitest'

import { isChunkLoadError } from './chunk-load-recovery'

describe('isChunkLoadError', () => {
  it('recognizes stale dynamic module failures', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module'))).toBe(
      true,
    )
    expect(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 42 failed'))).toBe(true)
  })

  it('does not classify application errors as chunk failures', () => {
    expect(isChunkLoadError(new Error('Invalid CSV'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})
