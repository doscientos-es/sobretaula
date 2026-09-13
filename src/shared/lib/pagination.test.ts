import { describe, expect, it } from 'vitest'

import { paginationRange } from './pagination'

describe('paginationRange', () => {
  it('creates a zero-based inclusive range for the requested page', () => {
    expect(paginationRange({ page: 1, pageSize: 25 })).toEqual({ from: 0, to: 24 })
    expect(paginationRange({ page: 3, pageSize: 10 })).toEqual({ from: 20, to: 29 })
  })
})
