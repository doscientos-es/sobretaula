import { describe, expect, it } from 'vitest'

import { requireProductEditor } from './product-schema'

describe('product permissions', () => {
  it.each(['owner', 'manager'] as const)('allows %s to manage recipes and inventory', (role) => {
    expect(() => requireProductEditor(role)).not.toThrow()
  })

  it.each(['host', 'waiter', 'accountant'] as const)(
    'denies %s from mutating product data',
    (role) => {
      expect(() => requireProductEditor(role)).toThrow(Response)
    },
  )
})
