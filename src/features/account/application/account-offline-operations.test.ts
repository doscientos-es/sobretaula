import { describe, expect, it } from 'vitest'

import { createAddOrderItemOperation } from './account-offline-operations'

describe('account offline operations', () => {
  it('uses the command id as a stable retry identity', () => {
    const operation = createAddOrderItemOperation({
      menuItemId: 'menu-item',
      operationId: 'command-123',
      quantity: 2,
      sessionId: 'session',
      tenantId: 'tenant',
      venueId: 'venue',
    })

    expect(operation.id).toBe('add-order-item:command-123')
    expect(operation.payload.operationId).toBe('command-123')
  })
})
